"""Add circular hike directions without changing existing records.

Revision ID: 007_circular_directions
Revises: 006_achievement_backpack
"""

from alembic import op

revision = "007_circular_directions"
down_revision = "006_achievement_backpack"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE direction ADD VALUE IF NOT EXISTS 'clockwise'")
        op.execute("ALTER TYPE direction ADD VALUE IF NOT EXISTS 'counterclockwise'")


def downgrade() -> None:
    # Retain additive enum values so existing hike directions remain readable.
    pass
