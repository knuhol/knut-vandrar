"""Allow hike-owned collections and explicit collection selection."""

import sqlalchemy as sa

from alembic import op

revision = "016_hike_track_collections"
down_revision = "015_track_collections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, check in (
        ("track_collections", "ck_track_collection_owner"),
        ("track_drafts", "ck_track_draft_owner"),
    ):
        with op.batch_alter_table(table) as batch:
            batch.alter_column("location_id", existing_type=sa.Uuid(), nullable=True)
            batch.add_column(sa.Column("hike_id", sa.Uuid(), nullable=True))
            batch.create_foreign_key(
                f"fk_{table}_hike", "hikes", ["hike_id"], ["id"], ondelete="CASCADE"
            )
            batch.create_unique_constraint(f"uq_{table}_hike_source", ["hike_id", "source_id"])
            batch.create_check_constraint(check, "(location_id IS NULL) != (hike_id IS NULL)")
    with op.batch_alter_table("hikes") as batch:
        batch.add_column(sa.Column("track_collection_id", sa.Uuid(), nullable=True))
        batch.create_index("ix_hikes_track_collection_id", ["track_collection_id"])
        batch.create_foreign_key(
            "fk_hike_track_collection",
            "track_collections",
            ["track_collection_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    connection = op.get_bind()
    if any(
        connection.execute(
            sa.text(f"SELECT 1 FROM {table} WHERE hike_id IS NOT NULL LIMIT 1")
        ).first()
        for table in ("track_collections", "track_drafts")
    ):
        raise RuntimeError("Hike-owned collections or drafts exist; move them before downgrading")
    with op.batch_alter_table("hikes") as batch:
        batch.drop_constraint("fk_hike_track_collection", type_="foreignkey")
        batch.drop_index("ix_hikes_track_collection_id")
        batch.drop_column("track_collection_id")
    for table, check in (
        ("track_drafts", "ck_track_draft_owner"),
        ("track_collections", "ck_track_collection_owner"),
    ):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(check, type_="check")
            batch.drop_constraint(f"uq_{table}_hike_source", type_="unique")
            batch.drop_constraint(f"fk_{table}_hike", type_="foreignkey")
            batch.drop_column("hike_id")
            batch.alter_column("location_id", existing_type=sa.Uuid(), nullable=False)
