"""Direction describes trail variants, not hike-owned collections."""

import sqlalchemy as sa

from alembic import op

revision = "017_hike_collection_direction"
down_revision = "016_hike_track_collections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("track_collections") as batch:
        batch.alter_column("direction", existing_type=sa.String(20), nullable=True)
    op.execute("UPDATE track_collections SET direction = NULL WHERE hike_id IS NOT NULL")
    with op.batch_alter_table("track_collections") as batch:
        batch.create_check_constraint(
            "ck_track_direction_owner",
            "(hike_id IS NOT NULL AND direction IS NULL) OR (location_id IS NOT NULL AND direction IS NOT NULL)",
        )


def downgrade() -> None:
    with op.batch_alter_table("track_collections") as batch:
        batch.drop_constraint("ck_track_direction_owner", type_="check")
    op.execute("UPDATE track_collections SET direction = 'forward' WHERE direction IS NULL")
    with op.batch_alter_table("track_collections") as batch:
        batch.alter_column("direction", existing_type=sa.String(20), nullable=False)
