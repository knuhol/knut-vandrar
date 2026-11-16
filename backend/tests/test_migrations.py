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
