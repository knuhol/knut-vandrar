"""Store Garmin tracking records and synchronization state."""

import sqlalchemy as sa

from alembic import op

revision = "028_garmin_tracking"
down_revision = "027_hike_cover_desktop"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "garmin_points",
        sa.Column(
            "hike_id", sa.Uuid(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("source_id", sa.String(128), primary_key=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
    )
    op.create_index("ix_garmin_points_hike_time", "garmin_points", ["hike_id", "recorded_at"])
    op.create_table(
        "garmin_sync",
        sa.Column(
            "hike_id", sa.Uuid(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("succeeded_at", sa.DateTime(timezone=True)),
        sa.Column("covered_until", sa.DateTime(timezone=True)),
        sa.Column("retry_after", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("garmin_sync")
    op.drop_table("garmin_points")
