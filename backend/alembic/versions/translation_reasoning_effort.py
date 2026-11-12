"""Store reasoning effort on translation profiles; initialize all profiles to medium.

Revision ID: 003_reasoning_effort
Revises: 002_review_status
"""

import sqlalchemy as sa

from alembic import op

revision = "003_reasoning_effort"
down_revision = "002_review_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "translation_profiles",
        sa.Column("reasoning_effort", sa.String(20), nullable=False, server_default="medium"),
    )


def downgrade() -> None:
    op.drop_column("translation_profiles", "reasoning_effort")
