"""Validate the migration graph without connecting to a database."""

from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from pytest import MonkeyPatch
from sqlalchemy import create_engine, inspect


def test_migrations_have_one_head() -> None:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    assert len(scripts.get_heads()) == 1, "Startup upgrades require a single migration head"


def test_media_receipt_migration_creates_recovery_table() -> None:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    migration = ScriptDirectory.from_config(config).get_revision("009_media_imports")
    assert migration is not None
    engine = create_engine("sqlite://")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            migration.module.upgrade()
            columns = {
                column["name"]
                for column in inspect(connection).get_columns("media_import_receipts")
            }
            assert columns == {"id", "created_at"}
    finally:
        engine.dispose()


def test_umami_policy_replaces_authored_fields_without_changing_other_records() -> None:
    import json

    from sqlalchemy import text

    config = Config()
    directory = Path(__file__).resolve().parents[1] / "alembic"
    config.set_main_option("script_location", str(directory))
    scripts = ScriptDirectory.from_config(config)
    engine = create_engine("sqlite://")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            for revision in ("012_manual_pages", "013_privacy_policy"):
                migration = scripts.get_revision(revision)
                assert migration is not None
                migration.module.upgrade()
            other_pages = connection.execute(
                text(
                    "SELECT id, content FROM page_locales WHERE page_key != 'privacy-policy' ORDER BY id"
                )
            ).all()
            custom = {
                "type": "standard",
                "eyebrow": "Old",
                "title": "Old",
                "introduction": "Old",
                "body_markdown": "Old text",
            }
            connection.execute(
                text(
                    "UPDATE page_locales SET content = :content, published = false, indexable = true WHERE page_key = 'privacy-policy' AND locale = 'cs'"
                ),
                {"content": json.dumps(custom)},
            )
            query = text(
                "SELECT id, locale, published, indexable, content FROM page_locales WHERE page_key = 'privacy-policy' ORDER BY locale"
            )
            before = {row.locale: row for row in connection.execute(query)}
            migration = scripts.get_revision("014_umami_privacy_policy")
            assert migration is not None
            migration.module.upgrade()
            expected = {
                row["locale"]: row["content"]
                for row in json.loads(
                    (directory / "versions" / "umami_privacy_policy_content.json").read_text()
                )
            }
            after = {row.locale: row for row in connection.execute(query)}
            assert set(after) == {"en", "sv", "cs"}
            for locale, row in after.items():
                assert (row.id, row.published, row.indexable) == (
                    before[locale].id,
                    before[locale].published,
                    before[locale].indexable,
                )
                assert json.loads(row.content) == expected[locale]
            assert (
                connection.execute(
                    text(
                        "SELECT id, content FROM page_locales WHERE page_key != 'privacy-policy' ORDER BY id"
                    )
                ).all()
                == other_pages
            )
            edited = {**expected["sv"], "title": "Edited after migration"}
            connection.execute(
                text(
                    "UPDATE page_locales SET content = :content WHERE page_key = 'privacy-policy' AND locale = 'sv'"
                ),
                {"content": json.dumps(edited)},
            )
            migration.module.downgrade()
            restored = {row.locale: json.loads(row.content) for row in connection.execute(query)}
            originals = {
                row["locale"]: row["content"]
                for row in json.loads(
                    (directory / "versions" / "privacy_policy_content.json").read_text()
                )
            }
            assert restored["sv"] == edited
            for locale in ("en", "cs"):
                assert restored[locale] == originals[locale]
    finally:
        engine.dispose()


def test_hike_collection_migration_preserves_existing_tracks() -> None:
    import pytest
    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    before = scripts.get_revision("015_track_collections")
    migration = scripts.get_revision("016_hike_track_collections")
    assert before is not None and migration is not None
    engine = create_engine("sqlite://")
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        connection.execute(sa.text("CREATE TABLE hiking_locations (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("CREATE TABLE hikes (id CHAR(32) PRIMARY KEY)"))
        connection.execute(
            sa.text("INSERT INTO hiking_locations VALUES ('00000000000000000000000000000001')")
        )
        connection.execute(sa.text("INSERT INTO hikes VALUES ('00000000000000000000000000000002')"))
        before.module.upgrade()
        connection.execute(
            sa.text(
                "INSERT INTO track_collections VALUES ('00000000000000000000000000000003', '00000000000000000000000000000001', '1', 'Existing trail', 'forward', '{}')"
            )
        )
        migration.module.upgrade()
        old = connection.execute(
            sa.text("SELECT name, location_id, hike_id FROM track_collections")
        ).one()
        assert old.name == "Existing trail" and old.location_id is not None and old.hike_id is None
        connection.execute(
            sa.text(
                "INSERT INTO track_collections (id, hike_id, source_id, name, direction, details) VALUES ('00000000000000000000000000000004', '00000000000000000000000000000002', '1', 'Custom hike', 'forward', '{}')"
            )
        )
        with pytest.raises(RuntimeError, match="Hike-owned"):
            migration.module.downgrade()
        connection.execute(sa.text("DELETE FROM track_collections WHERE hike_id IS NOT NULL"))
        migration.module.downgrade()
        assert "hike_id" not in {
            column["name"] for column in inspect(connection).get_columns("track_collections")
        }
        assert (
            connection.execute(sa.text("SELECT name FROM track_collections")).scalar()
            == "Existing trail"
        )
    engine.dispose()


def test_hike_direction_migration_preserves_trail_direction_and_hike_selection() -> None:
    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    engine = create_engine("sqlite://")
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        connection.execute(sa.text("CREATE TABLE hiking_locations (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("CREATE TABLE hikes (id CHAR(32) PRIMARY KEY)"))
        connection.execute(
            sa.text("INSERT INTO hiking_locations VALUES ('00000000000000000000000000000001')")
        )
        connection.execute(sa.text("INSERT INTO hikes VALUES ('00000000000000000000000000000002')"))
        for revision in ("015_track_collections", "016_hike_track_collections"):
            migration = scripts.get_revision(revision)
            assert migration is not None
            migration.module.upgrade()
        connection.execute(
            sa.text(
                "INSERT INTO track_collections (id, location_id, source_id, name, direction, details) VALUES ('00000000000000000000000000000003', '00000000000000000000000000000001', '1', 'Trail', 'backward', '{}')"
            )
        )
        connection.execute(
            sa.text(
                "INSERT INTO track_collections (id, hike_id, source_id, name, direction, details) VALUES ('00000000000000000000000000000004', '00000000000000000000000000000002', '1', 'Hike', 'backward', '{}')"
            )
        )
        connection.execute(
            sa.text("UPDATE hikes SET track_collection_id='00000000000000000000000000000004'")
        )
        migration = scripts.get_revision("017_hike_collection_direction")
        assert migration is not None
        migration.module.upgrade()
        rows: dict[str, str | None] = dict(
            connection.execute(sa.text("SELECT name, direction FROM track_collections")).all()
        )
        assert rows == {"Trail": "backward", "Hike": None}
        assert (
            connection.execute(sa.text("SELECT track_collection_id FROM hikes")).scalar()
            == "00000000000000000000000000000004"
        )
        migration.module.downgrade()
        rows = dict(
            connection.execute(sa.text("SELECT name, direction FROM track_collections")).all()
        )
        assert rows == {"Trail": "backward", "Hike": "forward"}
    engine.dispose()


def test_map_migration_preserves_hikes_and_has_unique_variants() -> None:
    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    migration = scripts.get_revision("018_hike_map_images")
    assert migration is not None
    engine = create_engine("sqlite://")
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        connection.execute(sa.text("CREATE TABLE hikes (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO hikes VALUES ('00000000000000000000000000000001')"))
        migration.module.upgrade()
        columns = {column["name"] for column in inspect(connection).get_columns("hike_map_images")}
        assert {"hike_id", "variant", "content", "fingerprint", "provenance"}.issubset(columns)
        assert set(
            inspect(connection).get_pk_constraint("hike_map_images")["constrained_columns"]
        ) == {"hike_id", "variant"}
        migration.module.downgrade()
        assert connection.execute(sa.text("SELECT COUNT(*) FROM hikes")).scalar() == 1
    engine.dispose()


def test_stopping_point_migration_transfers_legacy_fix_and_preserves_hikes() -> None:
    from uuid import UUID

    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    migration = ScriptDirectory.from_config(config).get_revision("019_hike_stopping_point")
    assert migration is not None
    engine = create_engine("sqlite://")
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        table = sa.Table("hikes", sa.MetaData(), sa.Column("id", sa.Uuid(), primary_key=True))
        table.create(connection)
        legacy = UUID("8275df26-f78b-45bb-8638-afee0da03c7e")
        other = UUID("00000000-0000-0000-0000-000000000001")
        connection.execute(table.insert(), [{"id": legacy}, {"id": other}])
        migration.module.upgrade()
        rows = connection.execute(
            sa.text(
                "SELECT stop_latitude,stop_longitude,stop_stage FROM hikes WHERE stop_stage IS NOT NULL"
            )
        ).all()
        assert len(rows) == 1
        assert tuple(rows[0]) == (59.84081, 15.96310, "11")
        assert {c["name"] for c in inspect(connection).get_check_constraints("hikes")} == {
            "ck_stop_coordinates_pair",
            "ck_stop_coordinates_range",
            "ck_stop_stage_coordinates",
        }
        migration.module.downgrade()
        assert connection.execute(sa.text("SELECT COUNT(*) FROM hikes")).scalar() == 2
        assert [c["name"] for c in inspect(connection).get_columns("hikes")] == ["id"]
    engine.dispose()


def test_editor_metadata_migration_preserves_existing_records(monkeypatch: MonkeyPatch) -> None:
    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    migration = scripts.get_revision("020_rating_na_named_route")
    assert migration is not None
    assert scripts.get_heads() == [migration.revision]
    # PostgreSQL enum DDL is verified separately through offline migration SQL.
    monkeypatch.setattr(migration.module, "_upgrade_enums", lambda: None)
    engine = create_engine("sqlite://")
    fields = migration.module.RATING_FIELDS
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        for table in ["hikes", "hiking_locations"]:
            connection.execute(sa.text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)"))
            connection.execute(sa.text(f"INSERT INTO {table} VALUES (1), (2)"))
        ratings = sa.Table(
            "location_ratings",
            sa.MetaData(),
            sa.Column("id", sa.Integer, primary_key=True),
            *[sa.Column(field, sa.Integer) for field in fields],
            *[
                sa.CheckConstraint(f"{field} BETWEEN 0 AND 10", name=f"ck_rating_{field}")
                for field in fields
            ],
        )
        ratings.create(connection)
        connection.execute(ratings.insert(), [{"id": 1, "facilities": 7}])
        migration.module.upgrade()
        assert connection.execute(
            sa.text("SELECT is_loop,named_route_name,named_route_url FROM hikes")
        ).all() == [(None, None, None), (None, None, None)]
        assert connection.execute(
            sa.text("SELECT boat_connection_required,is_national_park FROM hiking_locations")
        ).all() == [(None, None), (None, None)]
        connection.execute(sa.text("UPDATE location_ratings SET maintenance = -1"))
        migration.module.downgrade()
        assert connection.execute(
            sa.text("SELECT facilities,maintenance FROM location_ratings")
        ).one() == (7, None)
        for table in ["hikes", "hiking_locations"]:
            assert connection.execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar() == 2
            assert [column["name"] for column in inspect(connection).get_columns(table)] == ["id"]
    engine.dispose()
