"""Add commit receipts for recoverable media transfers."""

import sqlalchemy as sa

from alembic import op

revision = "009_media_imports"
down_revision = "008_hike_gallery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_import_receipts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("media_import_receipts")
