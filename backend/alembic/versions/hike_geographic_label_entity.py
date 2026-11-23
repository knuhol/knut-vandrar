"""Move geographic labels into independently translated hike content."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "026_hike_geo_label_entity"
down_revision = "025_hike_geo_label_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hike_geographic_labels",
        sa.Column("id", sa.Uuid(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "hike_geographic_label_translations",
        sa.Column(
            "label_id",
            sa.Uuid(),
            sa.ForeignKey("hike_geographic_labels.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "locale_code",
            sa.String(12),
            sa.ForeignKey("languages.code", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("geographic_label", sa.String(160)),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column(
            "review_status",
            postgresql.ENUM(name="translation_review_status", create_type=False),
            nullable=False,
        ),
        sa.Column("profile_fingerprint", sa.String(64)),
        sa.Column("provider", sa.String(60)),
        sa.Column("model", sa.String(120)),
        sa.Column("generated_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.execute("""
        INSERT INTO translation_profiles
            (id, content_type, target_locale, instructions, model, reasoning_effort)
        SELECT gen_random_uuid(), 'hike_geographic_label', target_locale, instructions, model,
               reasoning_effort
        FROM translation_profiles WHERE content_type = 'region'
    """)
    op.execute("""
        INSERT INTO translation_glossary_entries
            (id, profile_id, source_term, target_term, context, do_not_translate)
        SELECT gen_random_uuid(), target.id, glossary.source_term, glossary.target_term,
               glossary.context, glossary.do_not_translate
        FROM translation_profiles AS region
        JOIN translation_profiles AS target ON target.target_locale = region.target_locale
        JOIN translation_glossary_entries AS glossary ON glossary.profile_id = region.id
        WHERE region.content_type = 'region' AND target.content_type = 'hike_geographic_label'
    """)
    op.execute("""
        INSERT INTO hike_geographic_labels (id, source_revision)
        SELECT DISTINCT hike_id, 1 FROM hike_translations WHERE geographic_label IS NOT NULL
    """)
    op.execute("""
        INSERT INTO hike_geographic_label_translations
            (label_id, locale_code, geographic_label, source_revision, review_status,
             provider, model, generated_at, created_at, updated_at)
        SELECT hike_id, locale_code, geographic_label, 1, review_status,
               provider, model, generated_at, hike_translations.created_at, hike_translations.updated_at
        FROM hike_translations JOIN hike_geographic_labels ON hike_geographic_labels.id = hike_id
        WHERE geographic_label IS NOT NULL OR locale_code = 'en'
    """)
    op.execute("""
        INSERT INTO content_translation_versions
            (id, entity_type, entity_id, target_locale, version, fields, source_revision,
             review_status, provider, model, created_at)
        SELECT gen_random_uuid(), 'hike_geographic_label', t.hike_id, t.locale_code, v.version,
               jsonb_build_object('geographic_label', v.geographic_label), v.source_revision,
               'unreviewed', v.provider, v.model, v.generated_at
        FROM hike_translation_versions AS v JOIN hike_translations AS t ON t.id = v.translation_id
        WHERE v.geographic_label IS NOT NULL
    """)
    op.drop_column("hike_translation_versions", "geographic_label")
    op.drop_column("hike_translations", "geographic_label")


def downgrade() -> None:
    raise RuntimeError("Restore the pre-migration backup to undo the geographic label split.")
