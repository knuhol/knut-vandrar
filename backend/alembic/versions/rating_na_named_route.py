"""Extend hike routes, accommodation, location metadata and non-applicable ratings."""

import sqlalchemy as sa

from alembic import op

revision = "020_rating_na_named_route"
down_revision = "019_hike_stopping_point"
branch_labels = None
depends_on = None

RATING_FIELDS = ("facilities", "maintenance", "resupplies", "public_transport", "difficulty")


def _upgrade_enums() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE route_scope ADD VALUE IF NOT EXISTS 'named_hiking_route'")
        op.execute("ALTER TYPE accommodation_type ADD VALUE IF NOT EXISTS 'paid_shelter_or_hut'")


def upgrade() -> None:
    _upgrade_enums()
    op.add_column("hiking_locations", sa.Column("boat_connection_required", sa.Boolean()))
    op.add_column("hiking_locations", sa.Column("is_national_park", sa.Boolean()))
    op.add_column("hikes", sa.Column("named_route_name", sa.String(200)))
    op.add_column("hikes", sa.Column("named_route_url", sa.String(2048)))
    op.add_column("hikes", sa.Column("is_loop", sa.Boolean()))
    with op.batch_alter_table("location_ratings") as batch:
        for field in RATING_FIELDS:
            batch.drop_constraint(f"ck_rating_{field}", type_="check")
            batch.create_check_constraint(f"ck_rating_{field}", f"{field} BETWEEN -1 AND 10")


def downgrade() -> None:
    # Preserve N/A values as unrated when restoring the original score range.
    for field in RATING_FIELDS:
        op.execute(f"UPDATE location_ratings SET {field} = NULL WHERE {field} = -1")
    with op.batch_alter_table("location_ratings") as batch:
        for field in RATING_FIELDS:
            batch.drop_constraint(f"ck_rating_{field}", type_="check")
            batch.create_check_constraint(f"ck_rating_{field}", f"{field} BETWEEN 0 AND 10")
    op.drop_column("hikes", "is_loop")
    op.drop_column("hikes", "named_route_url")
    op.drop_column("hikes", "named_route_name")
    op.drop_column("hiking_locations", "is_national_park")
    op.drop_column("hiking_locations", "boat_connection_required")
    # Retain additive enum values to preserve recorded route scopes and overnight stays.
