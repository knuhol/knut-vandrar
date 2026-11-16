"""Add page templates and independently published localized content."""

import json
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "012_manual_pages"
down_revision = "011_live_position_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pages = op.create_table(
        "pages",
        sa.Column("key", sa.String(23), primary_key=True),
        sa.Column("template", sa.String(8), nullable=False),
    )
    locales = op.create_table(
        "page_locales",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("page_key", sa.String(23), sa.ForeignKey("pages.key"), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("indexable", sa.Boolean(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.UniqueConstraint("page_key", "locale", name="uq_page_locale"),
    )
    op.bulk_insert(
        pages,
        [
            {"key": "about", "template": "about"},
            {"key": "czech-translation-notes", "template": "standard"},
        ],
    )
    rows = json.loads(Path(__file__).with_name("page_content.json").read_text())
    op.bulk_insert(locales, [{"id": uuid4(), **row} for row in rows])


def downgrade() -> None:
    op.drop_table("page_locales")
    op.drop_table("pages")
