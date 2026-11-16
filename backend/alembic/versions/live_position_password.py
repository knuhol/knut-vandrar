"""Allow an optional public password on live tracking cards."""

import sqlalchemy as sa

from alembic import op

revision = "011_live_position_password"
down_revision = "010_gpx_collection_card"
branch_labels = None
depends_on = None


def upgrade() -> None:
    card_types = sa.table(
        "info_card_types",
        sa.column("type", sa.String()),
        sa.column("data_structure", sa.JSON()),
    )
    bind = op.get_bind()
    schema = bind.execute(
        sa.select(card_types.c.data_structure).where(card_types.c.type == "live_position")
    ).scalar_one()
    schema["properties"]["password"] = {
        "anyOf": [{"type": "string"}, {"type": "null"}],
        "default": None,
    }
    bind.execute(
        card_types.update()
        .where(card_types.c.type == "live_position")
        .values(data_structure=schema)
    )


def downgrade() -> None:
    raise RuntimeError("Remove stored public tracking passwords before reverting this migration.")
