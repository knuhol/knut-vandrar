"""Store generated map variants without changing editorial images."""

import sqlalchemy as sa

from alembic import op

revision = "018_hike_map_images"
down_revision = "017_hike_collection_direction"
branch_labels = None
depends_on = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_table("hike_map_images")
