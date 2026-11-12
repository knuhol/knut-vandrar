"""Persist hike details, reusable locations, regions and manual achievements.

Revision ID: 004_hiking_content
Revises: 003_reasoning_effort
"""

from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "004_hiking_content"
down_revision = "003_reasoning_effort"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE translation_review_status ADD VALUE IF NOT EXISTS 'manual'")
        op.execute("ALTER TYPE trail_type ADD VALUE IF NOT EXISTS 'coastal'")
    postgresql.ENUM("northbound", "southbound", "eastbound", "westbound", name="direction").create(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM("full_trail", "trail_section", "custom_route", name="route_scope").create(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM("trail", "area", name="location_kind").create(op.get_bind(), checkfirst=True)
    postgresql.ENUM("waymarked", "partly_waymarked", "unmarked", name="waymarking").create(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM("south", "crosses", "north", name="arctic_circle_position").create(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM("unknown", "known", name="information_status").create(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM(
        "trophy", "distance", "mountain", "compass", "tent", "arctic", name="achievement_icon"
    ).create(op.get_bind(), checkfirst=True)
    postgresql.ENUM("tap", "shop", "natural", name="water_source_type").create(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM(
        "tent",
        "free_shelter_or_hut",
        "mountain_hut",
        "other_paid_accommodation",
        name="accommodation_type",
    ).create(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "camping_restricted", "advance_booking_required", "fees_apply", name="restriction_type"
    ).create(op.get_bind(), checkfirst=True)
    op.create_table(
        "content_translation_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_type", sa.String(60), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column(
            "target_locale",
            sa.String(),
            sa.ForeignKey("languages.code", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("fields", postgresql.JSONB(), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("review_status", sa.String(30), nullable=False),
        sa.Column("profile_fingerprint", sa.String(64)),
        sa.Column("provider", sa.String(60)),
        sa.Column("model", sa.String(120)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "entity_type",
            "entity_id",
            "target_locale",
            "version",
            name="uq_content_translation_version",
        ),
    )
    op.rename_table("trails", "hiking_locations")
    op.rename_table("trail_countries", "location_countries")
    op.rename_table("trail_logos", "location_logos")
    for table in ("hikes", "location_countries", "location_logos"):
        op.alter_column(table, "trail_id", new_column_name="location_id")
    op.alter_column(
        "hikes", "distance_km", type_=sa.Numeric(8, 2), postgresql_using="distance_km::numeric"
    )
    op.add_column(
        "hiking_locations",
        sa.Column(
            "kind",
            postgresql.ENUM("trail", "area", name="location_kind", create_type=False),
            nullable=False,
            server_default="trail",
        ),
    )
    op.add_column(
        "hiking_locations",
        sa.Column("source_revision", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "hiking_locations",
        sa.Column("hiking_months_known", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "hiking_locations",
        sa.Column(
            "waymarking",
            postgresql.ENUM(
                "waymarked", "partly_waymarked", "unmarked", name="waymarking", create_type=False
            ),
            nullable=True,
        ),
    )
    op.add_column("hiking_locations", sa.Column("is_loop", sa.Boolean(), nullable=True))
    op.add_column(
        "hiking_locations",
        sa.Column(
            "arctic_circle_position",
            postgresql.ENUM(
                "south", "crosses", "north", name="arctic_circle_position", create_type=False
            ),
            nullable=True,
        ),
    )
    op.add_column("hiking_locations", sa.Column("information_checked_at", sa.Date(), nullable=True))
    op.add_column(
        "hiking_locations",
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.add_column(
        "hiking_locations",
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.add_column(
        "hiking_locations",
        sa.Column(
            "water_sources_status",
            postgresql.ENUM("unknown", "known", name="information_status", create_type=False),
            nullable=False,
            server_default="unknown",
        ),
    )
    op.add_column(
        "hiking_locations",
        sa.Column(
            "overnight_options_status",
            postgresql.ENUM("unknown", "known", name="information_status", create_type=False),
            nullable=False,
            server_default="unknown",
        ),
    )
    op.add_column(
        "hiking_locations",
        sa.Column(
            "overnight_restrictions_status",
            postgresql.ENUM("unknown", "known", name="information_status", create_type=False),
            nullable=False,
            server_default="unknown",
        ),
    )
    op.add_column("hikes", sa.Column("start_latitude", sa.Numeric(9, 6)))
    op.add_column("hikes", sa.Column("start_longitude", sa.Numeric(9, 6)))
    op.add_column("hikes", sa.Column("end_latitude", sa.Numeric(9, 6)))
    op.add_column("hikes", sa.Column("end_longitude", sa.Numeric(9, 6)))
    op.add_column("hikes", sa.Column("start_stage", sa.Integer()))
    op.add_column("hikes", sa.Column("end_stage", sa.Integer()))
    op.add_column("hikes", sa.Column("overnights_recorded_at", sa.DateTime(timezone=True)))
    op.add_column(
        "hikes",
        sa.Column(
            "direction",
            postgresql.ENUM(
                "northbound",
                "southbound",
                "eastbound",
                "westbound",
                name="direction",
                create_type=False,
            ),
        ),
    )
    op.add_column(
        "hikes",
        sa.Column(
            "route_scope",
            postgresql.ENUM(
                "full_trail", "trail_section", "custom_route", name="route_scope", create_type=False
            ),
        ),
    )
    op.create_table(
        "regions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "location_hiking_months",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("month", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("month BETWEEN 1 AND 12", name="ck_location_hiking_months"),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "month"),
    )
    op.create_table(
        "location_overnight_options",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column(
            "accommodation_type",
            postgresql.ENUM(
                "tent",
                "free_shelter_or_hut",
                "mountain_hut",
                "other_paid_accommodation",
                name="accommodation_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "accommodation_type"),
    )
    op.create_table(
        "location_overnight_restrictions",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column(
            "restriction_type",
            postgresql.ENUM(
                "camping_restricted",
                "advance_booking_required",
                "fees_apply",
                name="restriction_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "restriction_type"),
    )
    op.create_table(
        "location_ratings",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("assessed_at", sa.Date(), nullable=True),
        sa.Column("facilities", sa.SmallInteger(), nullable=True),
        sa.Column("maintenance", sa.SmallInteger(), nullable=True),
        sa.Column("resupplies", sa.SmallInteger(), nullable=True),
        sa.Column("public_transport", sa.SmallInteger(), nullable=True),
        sa.Column("difficulty", sa.SmallInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("difficulty BETWEEN 0 AND 10", name="ck_rating_difficulty"),
        sa.CheckConstraint("facilities BETWEEN 0 AND 10", name="ck_rating_facilities"),
        sa.CheckConstraint("maintenance BETWEEN 0 AND 10", name="ck_rating_maintenance"),
        sa.CheckConstraint("public_transport BETWEEN 0 AND 10", name="ck_rating_public_transport"),
        sa.CheckConstraint("resupplies BETWEEN 0 AND 10", name="ck_rating_resupplies"),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id"),
    )
    op.create_table(
        "location_regions",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("region_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["region_id"], ["regions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("location_id", "region_id"),
    )
    op.create_table(
        "location_terrains",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column(
            "terrain",
            postgresql.ENUM(
                "mountains", "lowlands", "coastal", name="trail_type", create_type=False
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "terrain"),
    )
    op.create_table(
        "location_translations",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("season_note", sa.Text(), nullable=True),
        sa.Column("overnight_restrictions_note", sa.Text(), nullable=True),
        sa.Column("locale_code", sa.String(length=12), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "review_status",
            postgresql.ENUM(
                "manual",
                "source",
                "unreviewed",
                "approved",
                "needs_retranslation",
                name="translation_review_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("profile_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["locale_code"], ["languages.code"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "locale_code"),
    )
    op.create_table(
        "location_water_sources",
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column(
            "source_type",
            postgresql.ENUM("tap", "shop", "natural", name="water_source_type", create_type=False),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["hiking_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("location_id", "source_type"),
    )
    op.create_table(
        "region_translations",
        sa.Column("region_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("locale_code", sa.String(length=12), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "review_status",
            postgresql.ENUM(
                "manual",
                "source",
                "unreviewed",
                "approved",
                "needs_retranslation",
                name="translation_review_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("profile_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["locale_code"], ["languages.code"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["region_id"], ["regions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("region_id", "locale_code"),
    )
    op.create_table(
        "hike_achievements",
        sa.Column("hike_id", sa.Uuid(), nullable=False),
        sa.Column(
            "icon",
            postgresql.ENUM(
                "trophy",
                "distance",
                "mountain",
                "compass",
                "tent",
                "arctic",
                name="achievement_icon",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("sort_order >= 0", name="ck_achievement_order"),
        sa.ForeignKeyConstraint(["hike_id"], ["hikes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "hike_overnights",
        sa.Column("hike_id", sa.Uuid(), nullable=False),
        sa.Column(
            "accommodation_type",
            postgresql.ENUM(
                "tent",
                "free_shelter_or_hut",
                "mountain_hut",
                "other_paid_accommodation",
                name="accommodation_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("night_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("night_count > 0", name="ck_hike_overnights"),
        sa.ForeignKeyConstraint(["hike_id"], ["hikes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("hike_id", "accommodation_type"),
    )
    op.create_table(
        "achievement_translations",
        sa.Column("achievement_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("locale_code", sa.String(length=12), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "review_status",
            postgresql.ENUM(
                "manual",
                "source",
                "unreviewed",
                "approved",
                "needs_retranslation",
                name="translation_review_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("profile_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["achievement_id"], ["hike_achievements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["locale_code"], ["languages.code"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("achievement_id", "locale_code"),
    )
    op.create_index("ix_hike_achievements_hike_id", "hike_achievements", ["hike_id"])
    op.execute(
        "INSERT INTO location_translations (location_id, locale_code, name, source_revision, review_status) SELECT id, 'en', name, 1, 'source' FROM hiking_locations"
    )
    op.execute(
        "INSERT INTO location_terrains (location_id, terrain) SELECT id, type FROM hiking_locations"
    )
    op.drop_column("hiking_locations", "name")
    op.drop_column("hiking_locations", "type")
    op.create_check_constraint(
        "ck_location_area_loop", "hiking_locations", "kind = 'trail' OR is_loop IS NULL"
    )
    for endpoint in ("start", "end"):
        op.create_check_constraint(
            f"ck_{endpoint}_coordinates_pair",
            "hikes",
            f"({endpoint}_latitude IS NULL) = ({endpoint}_longitude IS NULL)",
        )
        op.create_check_constraint(
            f"ck_{endpoint}_coordinates_range",
            "hikes",
            f"{endpoint}_latitude BETWEEN -90 AND 90 AND {endpoint}_longitude BETWEEN -180 AND 180",
        )
    op.create_check_constraint(
        "ck_stages_pair", "hikes", "(start_stage IS NULL) = (end_stage IS NULL)"
    )
    op.create_check_constraint("ck_stages_positive", "hikes", "start_stage > 0 AND end_stage > 0")
    bind = op.get_bind()
    profiles = (
        bind.execute(sa.text("SELECT * FROM translation_profiles WHERE content_type = 'hike'"))
        .mappings()
        .all()
    )
    for kind in ("location", "region", "achievement"):
        for profile in profiles:
            bind.execute(
                sa.text(
                    "INSERT INTO translation_profiles (id, content_type, target_locale, instructions, model, reasoning_effort) VALUES (:id, :kind, :locale, :instructions, :model, :effort)"
                ),
                {
                    "id": uuid4(),
                    "kind": kind,
                    "locale": profile["target_locale"],
                    "instructions": profile["instructions"]
                    + " Preserve each newline in multiline notes. Translate names only when a conventional localized name exists.",
                    "model": profile["model"],
                    "effort": profile["reasoning_effort"],
                },
            )


def downgrade() -> None:
    raise RuntimeError(
        "This data-preserving content migration cannot be automatically reversed; restore the pre-migration backup."
    )
