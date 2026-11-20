"""Move stopping fixes from map configuration into editable hike data."""

import sqlalchemy as sa

from alembic import op

revision = "019_hike_stopping_point"
down_revision = "018_hike_map_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("hikes") as batch:
        batch.add_column(sa.Column("stop_latitude", sa.Numeric(9, 6), nullable=True))
        batch.add_column(sa.Column("stop_longitude", sa.Numeric(9, 6), nullable=True))
        batch.add_column(sa.Column("stop_stage", sa.String(40), nullable=True))
        batch.create_check_constraint(
            "ck_stop_coordinates_pair", "(stop_latitude IS NULL) = (stop_longitude IS NULL)"
        )
        batch.create_check_constraint(
            "ck_stop_coordinates_range",
            "stop_latitude BETWEEN -90 AND 90 AND stop_longitude BETWEEN -180 AND 180",
        )
        batch.create_check_constraint(
            "ck_stop_stage_coordinates", "stop_stage IS NULL OR stop_latitude IS NOT NULL"
        )
    # One-time transfer of the factual stopping fix formerly stored in maps/hikes.json.
    # No hike-specific behaviour remains in the generator.
    hikes = sa.table(
        "hikes",
        sa.column("id", sa.Uuid()),
        sa.column("stop_latitude"),
        sa.column("stop_longitude"),
        sa.column("stop_stage"),
    )
    from uuid import UUID

    op.execute(
        hikes.update()
        .where(hikes.c.id == UUID("8275df26-f78b-45bb-8638-afee0da03c7e"))
        .values(stop_latitude=59.84081, stop_longitude=15.96310, stop_stage="11")
    )


def downgrade() -> None:
    with op.batch_alter_table("hikes") as batch:
        batch.drop_constraint("ck_stop_stage_coordinates", type_="check")
        batch.drop_constraint("ck_stop_coordinates_range", type_="check")
        batch.drop_constraint("ck_stop_coordinates_pair", type_="check")
        batch.drop_column("stop_stage")
        batch.drop_column("stop_longitude")
        batch.drop_column("stop_latitude")
