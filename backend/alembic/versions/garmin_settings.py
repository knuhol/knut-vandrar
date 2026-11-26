"""Move the Garmin password from hike cards into site-wide settings."""

import sqlalchemy as sa

from alembic import op

revision = "029_garmin_settings"
down_revision = "028_garmin_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "garmin_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("password", sa.String(256), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_garmin_settings_singleton"),
    )
    op.execute(
        "UPDATE hike_info_cards SET data = data::jsonb - 'password' "
        "WHERE type = 'live_position' AND data::jsonb ? 'password'"
    )
    op.execute(
        "UPDATE info_card_types SET data_structure = data_structure::jsonb #- '{properties,password}' "
        "WHERE type = 'live_position'"
    )


def downgrade() -> None:
    op.drop_table("garmin_settings")
