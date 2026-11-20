"""Trail track collections and resumable import drafts."""

import sqlalchemy as sa

from alembic import op

revision = "015_track_collections"
down_revision = "014_umami_privacy_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "track_collections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "location_id",
            sa.Uuid(),
            sa.ForeignKey("hiking_locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_id", sa.String(40), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.UniqueConstraint("location_id", "source_id"),
        sa.CheckConstraint("direction IN ('forward', 'backward')", name="ck_track_direction"),
    )
    op.create_table(
        "track_routes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "collection_id",
            sa.Uuid(),
            sa.ForeignKey("track_collections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_id", sa.String(40), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("overrides", sa.JSON(), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.UniqueConstraint("collection_id", "source_id"),
    )
    op.create_table(
        "track_drafts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "location_id",
            sa.Uuid(),
            sa.ForeignKey("hiking_locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_id", sa.String(40), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.UniqueConstraint("location_id", "source_id"),
    )


def downgrade() -> None:
    op.drop_table("track_drafts")
    op.drop_table("track_routes")
    op.drop_table("track_collections")
