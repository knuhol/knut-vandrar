"""Move live tracking activation from individual hikes to site settings."""

import sqlalchemy as sa

from alembic import op

revision = "030_site_wide_live_tracking"
down_revision = "029_garmin_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "garmin_settings",
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE garmin_settings SET active = TRUE WHERE btrim(password) <> ''")


def downgrade() -> None:
    op.drop_column("garmin_settings", "active")
