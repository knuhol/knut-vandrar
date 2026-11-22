"""Separate active and finished hike information-card priorities.

Existing priorities are copied into both columns. Downgrade retains active priorities.
"""

import sqlalchemy as sa

from alembic import op

revision = "021_status_card_order"
down_revision = "020_rating_na_named_route"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("info_card_types") as batch:
        batch.drop_constraint("ck_info_card_type_sort_order", type_="check")
        batch.alter_column(
            "sort_order", new_column_name="sort_order_active", existing_type=sa.Integer()
        )
        batch.add_column(
            sa.Column("sort_order_finished", sa.Integer(), nullable=False, server_default="0")
        )
        batch.create_check_constraint("ck_info_card_type_order_active", "sort_order_active >= 0")
        batch.create_check_constraint(
            "ck_info_card_type_order_finished", "sort_order_finished >= 0"
        )
    types = sa.table(
        "info_card_types", sa.column("sort_order_active"), sa.column("sort_order_finished")
    )
    op.execute(types.update().values(sort_order_finished=types.c.sort_order_active))


def downgrade() -> None:
    with op.batch_alter_table("info_card_types") as batch:
        batch.drop_constraint("ck_info_card_type_order_finished", type_="check")
        batch.drop_constraint("ck_info_card_type_order_active", type_="check")
        batch.drop_column("sort_order_finished")
        batch.alter_column(
            "sort_order_active", new_column_name="sort_order", existing_type=sa.Integer()
        )
        batch.create_check_constraint("ck_info_card_type_sort_order", "sort_order >= 0")
