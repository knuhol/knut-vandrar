"""Translation configuration and durable work queue."""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base

JsonType = JSON().with_variant(JSONB(), "postgresql")


class TranslationProfile(Base):
    __tablename__ = "translation_profiles"
    __table_args__ = (
        UniqueConstraint("content_type", "target_locale", name="uq_translation_profile_target"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    content_type: Mapped[str] = mapped_column(String(60), nullable=False)
    target_locale: Mapped[str] = mapped_column(
        ForeignKey("languages.code", ondelete="RESTRICT"), nullable=False
    )
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False, default="gpt-6-luna")
    reasoning_effort: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium", server_default="medium"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class TranslationGlossaryEntry(Base):
    __tablename__ = "translation_glossary_entries"
    __table_args__ = (Index("ix_glossary_profile_source", "profile_id", "source_term"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("translation_profiles.id", ondelete="CASCADE"), nullable=False
    )
    source_term: Mapped[str] = mapped_column(String(300), nullable=False)
    target_term: Mapped[str | None] = mapped_column(String(300))
    context: Mapped[str | None] = mapped_column(Text)
    do_not_translate: Mapped[bool] = mapped_column(default=False, nullable=False)


class TranslationJob(Base):
    __tablename__ = "translation_jobs"
    __table_args__ = (
        Index("ix_translation_jobs_ready", "status", "available_at", "created_at"),
        Index(
            "ix_translation_jobs_target",
            "entity_type",
            "entity_id",
            "target_locale",
            "source_revision",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(nullable=False)
    target_locale: Mapped[str] = mapped_column(
        ForeignKey("languages.code", ondelete="RESTRICT"), nullable=False
    )
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    profile_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_error: Mapped[str | None] = mapped_column(Text)
    usage: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ContentTranslationVersion(Base):
    """Immutable translation snapshots; entity identifiers intentionally survive deletion."""

    __tablename__ = "content_translation_versions"
    __table_args__ = (
        UniqueConstraint(
            "entity_type",
            "entity_id",
            "target_locale",
            "version",
            name="uq_content_translation_version",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[UUID] = mapped_column()
    target_locale: Mapped[str] = mapped_column(ForeignKey("languages.code", ondelete="RESTRICT"))
    version: Mapped[int] = mapped_column(Integer)
    fields: Mapped[dict[str, Any]] = mapped_column(JsonType)
    source_revision: Mapped[int] = mapped_column(Integer)
    review_status: Mapped[str] = mapped_column(String(30))
    profile_fingerprint: Mapped[str | None] = mapped_column(String(64))
    provider: Mapped[str | None] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
