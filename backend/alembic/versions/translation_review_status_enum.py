"""Convert translation review status to a native enum without losing data.

Revision ID: 002_review_status
Revises: 001_initial
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "002_review_status"
down_revision = "001_initial"
branch_labels = None
depends_on = None

review_status = postgresql.ENUM(
    "source",
    "unreviewed",
    "approved",
    "needs_retranslation",
    name="translation_review_status",
    create_type=False,
)


def upgrade() -> None:
    review_status.create(op.get_bind(), checkfirst=False)
    op.drop_constraint("ck_hike_translation_review_status", "hike_translations", type_="check")
    op.alter_column("hike_translations", "review_status", server_default=None)
    op.alter_column(
        "hike_translations",
        "review_status",
        type_=review_status,
        postgresql_using="review_status::translation_review_status",
    )
    op.alter_column("hike_translations", "review_status", server_default="unreviewed")


def downgrade() -> None:
    op.alter_column("hike_translations", "review_status", server_default=None)
    op.alter_column(
        "hike_translations",
        "review_status",
        type_=sa.String(30),
        postgresql_using="review_status::text",
    )
    op.alter_column("hike_translations", "review_status", server_default="unreviewed")
    op.create_check_constraint(
        "ck_hike_translation_review_status",
        "hike_translations",
        "review_status IN ('source', 'unreviewed', 'approved', 'needs_retranslation')",
    )
    review_status.drop(op.get_bind(), checkfirst=False)
