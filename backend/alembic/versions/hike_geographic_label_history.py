"""Include geographic labels in hike translation history."""

import sqlalchemy as sa

from alembic import op

revision = "025_hike_geo_label_history"
down_revision = "024_hike_geographic_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hike_translation_versions", sa.Column("geographic_label", sa.String(160)))


def downgrade() -> None:
    op.drop_column("hike_translation_versions", "geographic_label")
