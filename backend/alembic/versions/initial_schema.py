"""Create the current hiking, image, and translation schema.

Revision ID: 001_initial
Revises:
Create Date: 2026-11-06
"""

import json
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "001_initial"
down_revision = None
branch_label = None
depends_on = None

json_data = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
hike_status_enum = postgresql.ENUM(
    "planned", "ongoing", "completed", "aborted", name="hike_status", create_type=False
)
trail_type_enum = postgresql.ENUM("mountains", "lowlands", name="trail_type", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    hike_status_enum.create(bind, checkfirst=False)
    trail_type_enum.create(bind, checkfirst=False)

    op.create_table(
        "languages",
        sa.Column("code", sa.String(length=12), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_source", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "info_card_types",
        sa.Column("type", sa.String(length=50), primary_key=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("data_structure", json_data, nullable=False),
        sa.CheckConstraint("sort_order >= 0", name="ck_info_card_type_sort_order"),
    )
    op.create_table(
        "trails",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", trail_type_enum, nullable=False),
        sa.Column("official_url", sa.String(length=2048)),
    )
    op.create_table(
        "trail_logos",
        sa.Column("trail_id", sa.Uuid(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["trail_id"], ["trails.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trail_id"),
    )
    op.create_table(
        "trail_countries",
        sa.Column("trail_id", sa.Uuid(), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.CheckConstraint("length(country_code) = 2"),
        sa.ForeignKeyConstraint(["trail_id"], ["trails.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trail_id", "country_code"),
    )
    op.create_table(
        "hikes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("trail_id", sa.Uuid()),
        sa.Column("status", hike_status_enum, nullable=False),
        sa.Column("planned_start_at", sa.DateTime(timezone=True)),
        sa.Column("planned_end_at", sa.DateTime(timezone=True)),
        sa.Column("actual_start_at", sa.DateTime(timezone=True)),
        sa.Column("actual_end_at", sa.DateTime(timezone=True)),
        sa.Column("distance_km", sa.Integer()),
        sa.Column("ascent_m", sa.Integer()),
        sa.Column("start_point", sa.String(length=300)),
        sa.Column("end_point", sa.String(length=300)),
        sa.Column("source_revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("distance_km IS NULL OR distance_km >= 0", name="ck_hike_distance"),
        sa.CheckConstraint("ascent_m IS NULL OR ascent_m >= 0", name="ck_hike_ascent"),
        sa.CheckConstraint(
            "planned_start_at IS NULL OR planned_end_at IS NULL OR planned_end_at > planned_start_at",
            name="ck_hike_planned_time_order",
        ),
        sa.CheckConstraint(
            "actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at > actual_start_at",
            name="ck_hike_actual_time_order",
        ),
        sa.ForeignKeyConstraint(["trail_id"], ["trails.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "hike_cover_images",
        sa.Column("hike_id", sa.Uuid(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["hike_id"], ["hikes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("hike_id"),
    )
    op.create_table(
        "hike_translations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("hike_id", sa.Uuid(), nullable=False),
        sa.Column("locale_code", sa.String(length=12), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("tagline", sa.String(length=500)),
        sa.Column("summary_markdown", sa.Text(), nullable=False),
        sa.Column("description_markdown", sa.Text()),
        sa.Column("slug", sa.String(length=260), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("profile_fingerprint", sa.String(length=64)),
        sa.Column(
            "review_status", sa.String(length=30), nullable=False, server_default="unreviewed"
        ),
        sa.Column("provider", sa.String(length=60)),
        sa.Column("model", sa.String(length=120)),
        sa.Column("generated_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "review_status IN ('source', 'unreviewed', 'approved', 'needs_retranslation')",
            name="ck_hike_translation_review_status",
        ),
        sa.ForeignKeyConstraint(["hike_id"], ["hikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["locale_code"], ["languages.code"], ondelete="RESTRICT"),
        sa.UniqueConstraint("hike_id", "locale_code", name="uq_hike_translation_locale"),
        sa.UniqueConstraint("locale_code", "slug", name="uq_hike_translation_slug"),
    )
    op.create_table(
        "hike_slug_aliases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("hike_id", sa.Uuid(), nullable=False),
        sa.Column("locale_code", sa.String(length=12), nullable=False),
        sa.Column("slug", sa.String(length=260), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["hike_id"], ["hikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["locale_code"], ["languages.code"], ondelete="RESTRICT"),
        sa.UniqueConstraint("locale_code", "slug", name="uq_hike_alias_slug"),
    )
    op.create_table(
        "hike_info_cards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("hike_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("data", json_data, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("sort_order >= 0", name="ck_hike_info_card_sort_order"),
        sa.ForeignKeyConstraint(["hike_id"], ["hikes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["type"], ["info_card_types.type"], ondelete="RESTRICT"),
    )
    op.create_table(
        "hike_translation_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("translation_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("tagline", sa.String(length=500)),
        sa.Column("summary_markdown", sa.Text(), nullable=False),
        sa.Column("description_markdown", sa.Text()),
        sa.Column("slug", sa.String(length=260), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("profile_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=60), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["translation_id"], ["hike_translations.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("translation_id", "version"),
    )
    op.create_table(
        "translation_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("content_type", sa.String(length=60), nullable=False),
        sa.Column("target_locale", sa.String(length=12), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["target_locale"], ["languages.code"], ondelete="RESTRICT"),
        sa.UniqueConstraint("content_type", "target_locale", name="uq_translation_profile_target"),
    )
    op.create_table(
        "translation_glossary_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("source_term", sa.String(length=300), nullable=False),
        sa.Column("target_term", sa.String(length=300)),
        sa.Column("context", sa.Text()),
        sa.Column("do_not_translate", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["profile_id"], ["translation_profiles.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_glossary_profile_source", "translation_glossary_entries", ["profile_id", "source_term"]
    )
    op.create_table(
        "translation_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("target_locale", sa.String(length=12), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("profile_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("last_error", sa.Text()),
        sa.Column("usage", json_data),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["target_locale"], ["languages.code"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_translation_jobs_ready", "translation_jobs", ["status", "available_at", "created_at"]
    )
    op.create_index(
        "ix_translation_jobs_target",
        "translation_jobs",
        ["entity_type", "entity_id", "target_locale", "source_revision"],
    )

    languages = sa.table(
        "languages",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("enabled", sa.Boolean),
        sa.column("is_source", sa.Boolean),
    )
    op.bulk_insert(
        languages,
        [
            {"code": "en", "name": "English", "enabled": True, "is_source": True},
            {"code": "sv", "name": "Swedish", "enabled": True, "is_source": False},
            {"code": "cs", "name": "Czech", "enabled": True, "is_source": False},
        ],
    )
    info_card_type_rows = [
        {
            "type": "route",
            "sort_order": 1,
            "data_structure": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "additionalProperties": False,
                "properties": {
                    "type": {"const": "route", "type": "string"},
                    "url": {
                        "format": "uri",
                        "maxLength": 2083,
                        "minLength": 1,
                        "type": "string",
                    },
                },
                "required": ["type", "url"],
                "type": "object",
            },
        },
        {
            "type": "progress",
            "sort_order": 2,
            "data_structure": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "additionalProperties": False,
                "properties": {
                    "type": {"const": "progress", "type": "string"},
                    "url": {
                        "format": "uri",
                        "maxLength": 2083,
                        "minLength": 1,
                        "type": "string",
                    },
                },
                "required": ["type", "url"],
                "type": "object",
            },
        },
        {
            "type": "live_position",
            "sort_order": 3,
            "data_structure": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "additionalProperties": False,
                "properties": {
                    "type": {"const": "live_position", "type": "string"},
                    "state": {"enum": ["active", "inactive"], "type": "string"},
                    "url": {
                        "anyOf": [
                            {
                                "format": "uri",
                                "maxLength": 2083,
                                "minLength": 1,
                                "type": "string",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                    },
                },
                "required": ["type", "state"],
                "type": "object",
            },
        },
        {
            "type": "equipment",
            "sort_order": 4,
            "data_structure": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "additionalProperties": False,
                "properties": {
                    "type": {"const": "equipment", "type": "string"},
                    "url": {
                        "format": "uri",
                        "maxLength": 2083,
                        "minLength": 1,
                        "type": "string",
                    },
                },
                "required": ["type", "url"],
                "type": "object",
            },
        },
        {
            "type": "social_feed",
            "sort_order": 5,
            "data_structure": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "additionalProperties": False,
                "properties": {
                    "type": {"const": "social_feed", "type": "string"},
                    "url": {
                        "format": "uri",
                        "maxLength": 2083,
                        "minLength": 1,
                        "type": "string",
                    },
                },
                "required": ["type", "url"],
                "type": "object",
            },
        },
        {
            "type": "youtube_video",
            "sort_order": 6,
            "data_structure": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "additionalProperties": False,
                "properties": {
                    "type": {"const": "youtube_video", "type": "string"},
                    "url": {
                        "format": "uri",
                        "maxLength": 2083,
                        "minLength": 1,
                        "pattern": (
                            "^https?://(?:youtube\\.com|www\\.youtube\\.com|"
                            "m\\.youtube\\.com|youtu\\.be)(?::[0-9]+)?(?:[/?#]|$)"
                        ),
                        "type": "string",
                    },
                },
                "required": ["type", "url"],
                "type": "object",
            },
        },
    ]
    for row in info_card_type_rows:
        data_structure = json.dumps(
            row["data_structure"], ensure_ascii=False, separators=(",", ":")
        )
        data_structure_literal = "'" + data_structure.replace("'", "''") + "'::jsonb"
        type_literal = "'" + row["type"].replace("'", "''") + "'"
        op.execute(
            sa.DDL(
                "INSERT INTO info_card_types (type, sort_order, data_structure) "
                f"VALUES ({type_literal}, {row['sort_order']}, {data_structure_literal})"
            )
        )
    profiles = sa.table(
        "translation_profiles",
        sa.column("id", sa.Uuid()),
        sa.column("content_type", sa.String),
        sa.column("target_locale", sa.String),
        sa.column("instructions", sa.Text),
        sa.column("model", sa.String),
    )
    op.bulk_insert(
        profiles,
        [
            {
                "id": UUID("00000000-0000-4000-8000-000000000001"),
                "content_type": "hike",
                "target_locale": "sv",
                "instructions": "Write idiomatic, natural Swedish. Preserve the author's first-person voice, Markdown formatting, place names, trail names, URLs, and emojis.",
                "model": "gpt-6-luna",
            },
            {
                "id": UUID("00000000-0000-4000-8000-000000000002"),
                "content_type": "hike",
                "target_locale": "cs",
                "instructions": "Write idiomatic, natural Czech. Preserve the author's first-person voice, Markdown formatting, place names, trail names, URLs, and emojis.",
                "model": "gpt-6-luna",
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_translation_jobs_target", table_name="translation_jobs")
    op.drop_index("ix_translation_jobs_ready", table_name="translation_jobs")
    op.drop_table("translation_jobs")
    op.drop_index("ix_glossary_profile_source", table_name="translation_glossary_entries")
    op.drop_table("translation_glossary_entries")
    op.drop_table("translation_profiles")
    op.drop_table("hike_translation_versions")
    op.drop_table("hike_info_cards")
    op.drop_table("info_card_types")
    op.drop_table("hike_slug_aliases")
    op.drop_table("hike_translations")
    op.drop_table("hike_cover_images")
    op.drop_table("hikes")
    op.drop_table("trail_countries")
    op.drop_table("trail_logos")
    op.drop_table("trails")
    trail_type_enum.drop(op.get_bind(), checkfirst=False)
    hike_status_enum.drop(op.get_bind(), checkfirst=False)
    op.drop_table("languages")
