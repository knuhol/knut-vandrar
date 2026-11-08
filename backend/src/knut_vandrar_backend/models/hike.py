"""Hike records, localized text, cards, and generated translation history."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy import (
    Enum as SqlEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.models.enums import HikeStatus, TranslationReviewStatus

if TYPE_CHECKING:
    from knut_vandrar_backend.models.trail import Trail

JsonType = JSON().with_variant(JSONB(), "postgresql")


class Hike(Base):
    __tablename__ = "hikes"
    __table_args__ = (
        CheckConstraint("distance_km IS NULL OR distance_km >= 0", name="ck_hike_distance"),
        CheckConstraint("ascent_m IS NULL OR ascent_m >= 0", name="ck_hike_ascent"),
        CheckConstraint(
            "planned_start_at IS NULL OR planned_end_at IS NULL OR planned_end_at > planned_start_at",
            name="ck_hike_planned_time_order",
        ),
        CheckConstraint(
            "actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at > actual_start_at",
            name="ck_hike_actual_time_order",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    trail_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("trails.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[HikeStatus] = mapped_column(
        SqlEnum(
            HikeStatus,
            name="hike_status",
            values_callable=lambda values: [value.value for value in values],
            validate_strings=True,
        ),
        nullable=False,
        default=HikeStatus.PLANNED,
    )
    planned_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    distance_km: Mapped[int | None] = mapped_column(Integer)
    ascent_m: Mapped[int | None] = mapped_column(Integer)
    start_point: Mapped[str | None] = mapped_column(String(300))
    end_point: Mapped[str | None] = mapped_column(String(300))
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    trail: Mapped["Trail | None"] = relationship(back_populates="hikes")
    translations: Mapped[list["HikeTranslation"]] = relationship(
        back_populates="hike", cascade="all, delete-orphan"
    )
    cards: Mapped[list["HikeInfoCard"]] = relationship(
        back_populates="hike", cascade="all, delete-orphan", order_by="HikeInfoCard.sort_order"
    )
    cover_image: Mapped["HikeCoverImage | None"] = relationship(
        back_populates="hike", cascade="all, delete-orphan", uselist=False
    )


class HikeCoverImage(Base):
    __tablename__ = "hike_cover_images"

    hike_id: Mapped[UUID] = mapped_column(
        ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
    )
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    hike: Mapped[Hike] = relationship(back_populates="cover_image")


class HikeTranslation(Base):
    __tablename__ = "hike_translations"
    __table_args__ = (
        UniqueConstraint("hike_id", "locale_code", name="uq_hike_translation_locale"),
        UniqueConstraint("locale_code", "slug", name="uq_hike_translation_slug"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    hike_id: Mapped[UUID] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    locale_code: Mapped[str] = mapped_column(ForeignKey("languages.code", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(500))
    summary_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    description_markdown: Mapped[str | None] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(260), nullable=False)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    profile_fingerprint: Mapped[str | None] = mapped_column(String(64))
    review_status: Mapped[TranslationReviewStatus] = mapped_column(
        SqlEnum(
            TranslationReviewStatus,
            name="translation_review_status",
            values_callable=lambda values: [value.value for value in values],
            validate_strings=True,
        ),
        nullable=False,
        default=TranslationReviewStatus.UNREVIEWED,
    )
    provider: Mapped[str | None] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(120))
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    hike: Mapped[Hike] = relationship(back_populates="translations")
    versions: Mapped[list["HikeTranslationVersion"]] = relationship(
        back_populates="translation",
        cascade="all, delete-orphan",
        order_by="HikeTranslationVersion.version",
    )


class HikeTranslationVersion(Base):
    __tablename__ = "hike_translation_versions"
    __table_args__ = (UniqueConstraint("translation_id", "version"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    translation_id: Mapped[UUID] = mapped_column(
        ForeignKey("hike_translations.id", ondelete="CASCADE")
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(500))
    summary_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    description_markdown: Mapped[str | None] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(260), nullable=False)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    profile_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str] = mapped_column(String(60), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    translation: Mapped[HikeTranslation] = relationship(back_populates="versions")


class HikeSlugAlias(Base):
    __tablename__ = "hike_slug_aliases"
    __table_args__ = (UniqueConstraint("locale_code", "slug", name="uq_hike_alias_slug"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    hike_id: Mapped[UUID] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    locale_code: Mapped[str] = mapped_column(ForeignKey("languages.code", ondelete="RESTRICT"))
    slug: Mapped[str] = mapped_column(String(260), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class HikeInfoCard(Base):
    __tablename__ = "hike_info_cards"
    __table_args__ = (CheckConstraint("sort_order >= 0", name="ck_hike_info_card_sort_order"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    hike_id: Mapped[UUID] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(
        String(50), ForeignKey("info_card_types.type", ondelete="RESTRICT"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    data: Mapped[dict[str, Any]] = mapped_column(JsonType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    hike: Mapped[Hike] = relationship(back_populates="cards")
