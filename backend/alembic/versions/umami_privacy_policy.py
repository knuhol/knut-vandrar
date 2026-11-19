"""Apply the supplied privacy policy translations for banner-free Umami analytics."""

import json
from pathlib import Path

import sqlalchemy as sa

from alembic import op

revision = "014_umami_privacy_policy"
down_revision = "013_privacy_policy"
branch_labels = None
depends_on = None


def _replace_content(source: str, destination: str, *, only_defaults: bool = False) -> None:
    directory = Path(__file__).parent
    old_rows = json.loads((directory / source).read_text())
    new_rows = json.loads((directory / destination).read_text())
    replacements = {row["locale"]: row["content"] for row in new_rows}
    locales = sa.table(
        "page_locales",
        sa.column("id", sa.Uuid),
        sa.column("page_key", sa.String),
        sa.column("locale", sa.String),
        sa.column("content", sa.JSON),
    )
    connection = op.get_bind()
    for old in old_rows:
        current = connection.execute(
            sa.select(locales.c.id, locales.c.content).where(
                locales.c.page_key == old["page_key"], locales.c.locale == old["locale"]
            )
        ).first()
        if current is None:
            continue
        content = dict(current.content)
        if only_defaults and any(
            content.get(key) != value for key, value in old["content"].items()
        ):
            # Do not overwrite later editorial changes when reverting the policy.
            continue
        content.update(replacements[old["locale"]])
        connection.execute(
            locales.update().where(locales.c.id == current.id).values(content=content)
        )


def upgrade() -> None:
    # All supplied policy fields are intentional replacements; IDs and flags stay intact.
    _replace_content("privacy_policy_content.json", "umami_privacy_policy_content.json")


def downgrade() -> None:
    _replace_content(
        "umami_privacy_policy_content.json", "privacy_policy_content.json", only_defaults=True
    )
