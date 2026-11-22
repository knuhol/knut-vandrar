"""Allow at most one information card of each type per hike."""

import sqlalchemy as sa

from alembic import op

revision = "022_unique_hike_card_types"
down_revision = "021_status_card_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cards = sa.table("hike_info_cards", sa.column("hike_id"), sa.column("type"))
    duplicate = (
        op.get_bind()
        .execute(
            sa.select(cards.c.hike_id, cards.c.type)
            .group_by(cards.c.hike_id, cards.c.type)
            .having(sa.func.count() > 1)
            .limit(1)
        )
        .first()
    )
    if duplicate is not None:
        raise RuntimeError(
            f"Hike {duplicate.hike_id} has multiple '{duplicate.type}' information cards. "
            "Remove duplicate types before retrying the migration; no cards were deleted."
        )
    with op.batch_alter_table("hike_info_cards") as batch:
        batch.create_unique_constraint("uq_hike_info_card_type", ["hike_id", "type"])


def downgrade() -> None:
    with op.batch_alter_table("hike_info_cards") as batch:
        batch.drop_constraint("uq_hike_info_card_type", type_="unique")
