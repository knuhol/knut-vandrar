"""Add a manually authored geographic label to hike translations."""

import sqlalchemy as sa

from alembic import op

revision = "024_hike_geographic_label"
down_revision = "023_hike_cover_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hike_translations", sa.Column("geographic_label", sa.String(160)))


def downgrade() -> None:
    op.drop_column("hike_translations", "geographic_label")
