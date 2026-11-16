"""Register GPX collection links as an optional hike information card."""

import sqlalchemy as sa

from alembic import op

revision = "010_gpx_collection_card"
down_revision = "009_media_imports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    card_types = sa.table(
        "info_card_types",
        sa.column("type", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("data_structure", sa.JSON()),
    )
    op.bulk_insert(
        card_types,
        [
            {
                "type": "gpx_collection",
                "sort_order": 7,
                "data_structure": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "additionalProperties": False,
                    "properties": {
                        "type": {"const": "gpx_collection", "type": "string"},
                        "url": {
                            "type": "string",
                            "format": "uri",
                            "minLength": 1,
                            "maxLength": 2083,
                        },
                    },
                    "required": ["type", "url"],
                    "type": "object",
                },
            }
        ],
    )


def downgrade() -> None:
    # The foreign key prevents removing a type that is still used by a hike.
    op.execute("DELETE FROM info_card_types WHERE type = 'gpx_collection'")
