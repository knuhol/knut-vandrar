"""Retain private cover originals and responsive derivatives."""

import sqlalchemy as sa

from alembic import op

revision = "023_hike_cover_assets"
down_revision = "022_unique_hike_card_types"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hike_cover_assets",
        sa.Column(
            "hike_id",
            sa.Uuid(),
            sa.ForeignKey("hike_cover_images.hike_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("kind", sa.String(16), primary_key=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('original', 'card', 'mobile')", name="ck_hike_cover_asset_kind"
        ),
    )


def downgrade() -> None:
    op.drop_table("hike_cover_assets")
