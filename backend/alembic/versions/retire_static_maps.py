"""Remove the generated map image table after switching to GPX maps."""

import sqlalchemy as sa

from alembic import op

revision = "031_retire_static_maps"
down_revision = "030_site_wide_live_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("hike_map_images")


def downgrade() -> None:
    # Restore the schema for older code. The generated images are reproducible artifacts.
    op.create_table(
        "hike_map_images",
        sa.Column(
            "hike_id", sa.Uuid(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("variant", sa.String(40), primary_key=True),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
        sa.CheckConstraint("width > 0 AND height > 0", name="ck_map_dimensions"),
    )
