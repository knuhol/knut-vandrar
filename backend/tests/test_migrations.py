"""Migration graph and data preservation using isolated SQLite databases."""

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


def test_static_map_retirement_preserves_hikes_and_can_restore_schema() -> None:
    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    migration = scripts.get_revision("018_hike_map_images")
    retirement = scripts.get_revision("031_retire_static_maps")
    assert migration is not None and retirement is not None
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
        retirement.module.upgrade()
        assert not inspect(connection).has_table("hike_map_images")
        assert connection.execute(sa.text("SELECT COUNT(*) FROM hikes")).scalar() == 1
        retirement.module.downgrade()
        assert {
            column["name"] for column in inspect(connection).get_columns("hike_map_images")
        } == (columns)
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


def test_card_status_order_migration_preserves_priorities_and_card_data() -> None:
    import pytest
    import sqlalchemy as sa
    from sqlalchemy.exc import IntegrityError

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    migration = ScriptDirectory.from_config(config).get_revision("021_status_card_order")
    assert migration is not None
    engine = create_engine("sqlite://")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            metadata = sa.MetaData()
            types = sa.Table(
                "info_card_types",
                metadata,
                sa.Column("type", sa.String(50), primary_key=True),
                sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
                sa.Column("data_structure", sa.JSON(), nullable=False),
                sa.CheckConstraint("sort_order >= 0", name="ck_info_card_type_sort_order"),
            )
            cards = sa.Table(
                "hike_info_cards",
                metadata,
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column("type", sa.String(50), sa.ForeignKey("info_card_types.type")),
                sa.Column("data", sa.JSON(), nullable=False),
            )
            metadata.create_all(connection)
            connection.execute(
                types.insert(),
                [
                    {"type": "route", "sort_order": 9, "data_structure": {"type": "object"}},
                    {
                        "type": "youtube_video",
                        "sort_order": 2,
                        "data_structure": {"type": "object"},
                    },
                ],
            )
            connection.execute(
                cards.insert(),
                {"id": 1, "type": "route", "data": {"url": "https://example.com/route"}},
            )
            before_types = connection.execute(
                sa.text("SELECT type, data_structure FROM info_card_types ORDER BY type")
            ).all()
            before_cards = connection.execute(sa.text("SELECT * FROM hike_info_cards")).all()

            migration.module.upgrade()
            assert connection.execute(
                sa.text(
                    "SELECT type, sort_order_active, sort_order_finished FROM info_card_types ORDER BY type"
                )
            ).all() == [("route", 9, 9), ("youtube_video", 2, 2)]
            assert "sort_order" not in {
                column["name"] for column in inspect(connection).get_columns("info_card_types")
            }
            connection.execute(
                sa.text("UPDATE info_card_types SET sort_order_finished = 0 WHERE type = 'route'")
            )
            assert connection.execute(
                sa.text(
                    "SELECT sort_order_active, sort_order_finished FROM info_card_types WHERE type = 'route'"
                )
            ).one() == (9, 0)
            for column in ("sort_order_active", "sort_order_finished"):
                with pytest.raises(IntegrityError), connection.begin_nested():
                    connection.execute(sa.text(f"UPDATE info_card_types SET {column} = -1"))

            migration.module.downgrade()
            assert connection.execute(
                sa.text("SELECT type, sort_order FROM info_card_types ORDER BY type")
            ).all() == [("route", 9), ("youtube_video", 2)]
            assert (
                connection.execute(
                    sa.text("SELECT type, data_structure FROM info_card_types ORDER BY type")
                ).all()
                == before_types
            )
            assert (
                connection.execute(sa.text("SELECT * FROM hike_info_cards")).all() == before_cards
            )
    finally:
        engine.dispose()


def test_unique_card_type_migration_preserves_rows_and_enforces_per_hike_uniqueness() -> None:
    import pytest
    import sqlalchemy as sa
    from sqlalchemy.exc import IntegrityError

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    migration = ScriptDirectory.from_config(config).get_revision("022_unique_hike_card_types")
    assert migration is not None
    engine = create_engine("sqlite://")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            metadata = sa.MetaData()
            cards = sa.Table(
                "hike_info_cards",
                metadata,
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column("hike_id", sa.String(), nullable=False),
                sa.Column("type", sa.String(), nullable=False),
                sa.Column("data", sa.JSON(), nullable=False),
            )
            cards.create(connection)
            connection.execute(
                cards.insert(),
                [
                    {"id": 1, "hike_id": "first", "type": "route", "data": {"url": "one"}},
                    {"id": 2, "hike_id": "second", "type": "route", "data": {"url": "two"}},
                ],
            )
            before = connection.execute(cards.select().order_by(cards.c.id)).all()
            migration.module.upgrade()
            assert connection.execute(cards.select().order_by(cards.c.id)).all() == before
            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.execute(
                    cards.insert(),
                    {"id": 3, "hike_id": "first", "type": "route", "data": {"url": "three"}},
                )
            connection.execute(
                cards.insert(),
                {"id": 4, "hike_id": "first", "type": "youtube_video", "data": {"url": "video"}},
            )
            migration.module.downgrade()
            connection.execute(
                cards.insert(),
                {"id": 3, "hike_id": "first", "type": "route", "data": {"url": "three"}},
            )
            assert connection.execute(sa.select(sa.func.count()).select_from(cards)).scalar() == 4
    finally:
        engine.dispose()


def test_unique_card_type_migration_refuses_to_discard_existing_duplicates() -> None:
    import pytest
    import sqlalchemy as sa

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    migration = ScriptDirectory.from_config(config).get_revision("022_unique_hike_card_types")
    assert migration is not None
    engine = create_engine("sqlite://")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            connection.execute(
                sa.text(
                    "CREATE TABLE hike_info_cards (id INTEGER PRIMARY KEY, hike_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL)"
                )
            )
            connection.execute(
                sa.text(
                    "INSERT INTO hike_info_cards VALUES (1, 'first', 'route', 'one'), (2, 'first', 'route', 'two')"
                )
            )
            before = connection.execute(sa.text("SELECT * FROM hike_info_cards ORDER BY id")).all()
            with pytest.raises(RuntimeError, match="first.*route"):
                migration.module.upgrade()
            assert (
                connection.execute(sa.text("SELECT * FROM hike_info_cards ORDER BY id")).all()
                == before
            )
            assert inspect(connection).get_unique_constraints("hike_info_cards") == []
    finally:
        engine.dispose()


def test_geographic_label_migration_copies_region_settings_and_moves_labels() -> None:
    import json
    from uuid import uuid4

    from sqlalchemy import text

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    migration = ScriptDirectory.from_config(config).get_revision("026_hike_geo_label_entity")
    assert migration is not None
    engine = create_engine("sqlite://")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            driver = connection.connection.driver_connection
            assert driver is not None
            driver.create_function("gen_random_uuid", 0, lambda: uuid4().hex)
            driver.create_function(
                "jsonb_build_object", 2, lambda key, value: json.dumps({key: value})
            )
            statements = (
                "CREATE TABLE hikes (id TEXT PRIMARY KEY)",
                "CREATE TABLE languages (code TEXT PRIMARY KEY)",
                "CREATE TABLE hike_translations (id TEXT, hike_id TEXT, locale_code TEXT, "
                "geographic_label TEXT, review_status TEXT, provider TEXT, model TEXT, "
                "generated_at TEXT, created_at TEXT, updated_at TEXT)",
                "CREATE TABLE hike_translation_versions (translation_id TEXT, version INT, "
                "geographic_label TEXT, source_revision INT, provider TEXT, model TEXT, generated_at TEXT)",
                "CREATE TABLE content_translation_versions (id TEXT, entity_type TEXT, entity_id TEXT, "
                "target_locale TEXT, version INT, fields TEXT, source_revision INT, review_status TEXT, "
                "provider TEXT, model TEXT, created_at TEXT)",
                "CREATE TABLE translation_profiles (id TEXT, content_type TEXT, target_locale TEXT, "
                "instructions TEXT, model TEXT, reasoning_effort TEXT)",
                "CREATE TABLE translation_glossary_entries (id TEXT, profile_id TEXT, source_term TEXT, "
                "target_term TEXT, context TEXT, do_not_translate BOOL)",
                "INSERT INTO translation_profiles VALUES ('region-sv', 'region', 'sv', "
                "'Use established names', 'region-model', 'low')",
                "INSERT INTO translation_glossary_entries VALUES "
                "('entry', 'region-sv', 'Lapland', 'Lappland', 'Finland', 0)",
                "INSERT INTO hike_translations VALUES ('article', 'hike', 'sv', 'Lappland', "
                "'manual', 'manual', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                "INSERT INTO hike_translation_versions VALUES "
                "('article', 1, 'Lappland', 1, 'openai', 'region-model', CURRENT_TIMESTAMP)",
            )
            for statement in statements:
                connection.execute(text(statement))
            migration.module.upgrade()

            profile = connection.execute(
                text(
                    "SELECT id, target_locale, instructions, model, reasoning_effort "
                    "FROM translation_profiles WHERE content_type = 'hike_geographic_label'"
                )
            ).one()
            assert profile.id != "region-sv"
            assert tuple(profile[1:]) == ("sv", "Use established names", "region-model", "low")
            glossary = connection.execute(
                text(
                    "SELECT source_term, target_term, context, do_not_translate "
                    "FROM translation_glossary_entries WHERE profile_id = :profile_id"
                ),
                {"profile_id": profile.id},
            ).one()
            assert tuple(glossary) == ("Lapland", "Lappland", "Finland", 0)
            assert connection.execute(
                text(
                    "SELECT geographic_label, review_status FROM hike_geographic_label_translations"
                )
            ).one() == ("Lappland", "manual")
            assert json.loads(
                connection.execute(
                    text("SELECT fields FROM content_translation_versions")
                ).scalar_one()
            ) == {"geographic_label": "Lappland"}
            assert "geographic_label" not in {
                column["name"] for column in inspect(connection).get_columns("hike_translations")
            }
    finally:
        engine.dispose()
