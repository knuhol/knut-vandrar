"""Add gallery metadata and photo translation profiles."""

from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "008_hike_gallery"
down_revision = "007_circular_directions"
branch_labels = None
depends_on = None


def audit_columns() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "hike_photos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "hike_id", sa.Uuid(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("original_type", sa.String(100), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        *audit_columns(),
    )
    op.create_index("ix_hike_photos_order", "hike_photos", ["hike_id", "sort_order", "id"])
    op.create_table(
        "photo_translations",
        sa.Column(
            "photo_id",
            sa.Uuid(),
            sa.ForeignKey("hike_photos.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "locale_code",
            sa.String(10),
            sa.ForeignKey("languages.code", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("alt", sa.String(1000), nullable=False),
        sa.Column("caption", sa.Text()),
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
        *audit_columns(),
    )
    bind = op.get_bind()
    for profile in bind.execute(
        sa.text("SELECT * FROM translation_profiles WHERE content_type='hike'")
    ).mappings():
        bind.execute(
            sa.text(
                "INSERT INTO translation_profiles (id, content_type, target_locale, instructions, model, reasoning_effort) VALUES (:id, 'photo', :locale, :instructions, :model, :effort)"
            ),
            dict(
                id=uuid4(),
                locale=profile["target_locale"],
                instructions=profile["instructions"]
                + " Translate photo captions and accessible image descriptions. Preserve null captions and empty descriptions; do not invent visual details.",
                model=profile["model"],
                effort=profile["reasoning_effort"],
            ),
        )


def downgrade() -> None:
    raise RuntimeError(
        "Gallery files and translations require a deliberate backup/restore; automatic downgrade is disabled."
    )
