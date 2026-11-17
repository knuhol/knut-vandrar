"""Seed editable privacy policy translations using the standard page template."""

import json
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "013_privacy_policy"
down_revision = "012_manual_pages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pages = sa.table("pages", sa.column("key", sa.String), sa.column("template", sa.String))
    locales = sa.table(
        "page_locales",
        sa.column("id", sa.Uuid),
        sa.column("page_key", sa.String),
        sa.column("locale", sa.String),
        sa.column("published", sa.Boolean),
        sa.column("indexable", sa.Boolean),
        sa.column("content", sa.JSON),
    )
    op.bulk_insert(pages, [{"key": "privacy-policy", "template": "standard"}])
    rows = json.loads(Path(__file__).with_name("privacy_policy_content.json").read_text())
    op.bulk_insert(locales, [{"id": uuid4(), **row} for row in rows])


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM page_locales WHERE page_key = 'privacy-policy'"))
    op.execute(sa.text("DELETE FROM pages WHERE key = 'privacy-policy'"))
