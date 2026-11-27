"""Store the site-wide inReach tracking interval in minutes."""

import sqlalchemy as sa

from alembic import op

revision = "032_garmin_tracking_interval"
down_revision = "031_retire_static_maps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "garmin_settings",
        sa.Column("tracking_interval_minutes", sa.Integer(), server_default="10", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("garmin_settings", "tracking_interval_minutes")
