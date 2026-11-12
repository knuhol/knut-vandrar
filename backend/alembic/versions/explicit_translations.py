"""Cancel pending automatically generated translation work.

Revision ID: 005_explicit_translations
Revises: 004_hiking_content
"""

from alembic import op

revision = "005_explicit_translations"
down_revision = "004_hiking_content"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE translation_jobs SET status = 'superseded', updated_at = CURRENT_TIMESTAMP WHERE status IN ('queued', 'running') AND reason NOT IN ('needs_retranslation', 'explicit_request')"
    )


def downgrade() -> None:
    # Cancellation cannot safely be undone: never restart paid work on downgrade.
    pass
