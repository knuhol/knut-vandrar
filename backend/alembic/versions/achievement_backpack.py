"""Add a backpack icon for manually authored self-sufficiency achievements.

Revision ID: 006_achievement_backpack
Revises: 005_explicit_translations
"""

from alembic import op

revision = "006_achievement_backpack"
down_revision = "005_explicit_translations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE achievement_icon ADD VALUE IF NOT EXISTS 'backpack'")


def downgrade() -> None:
    # PostgreSQL cannot remove an enum value without rebuilding the type. Retain
    # this additive value to avoid damaging existing manually authored badges.
    pass
