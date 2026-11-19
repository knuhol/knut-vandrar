"""Validate the migration graph without connecting to a database."""

from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
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
