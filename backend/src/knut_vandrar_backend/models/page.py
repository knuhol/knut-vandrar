"""Manually authored pages; each locale has an independent publication state."""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.models.enums import PageKey, PageTemplate


class PageDefinition(Base):
    __tablename__ = "pages"

    key: Mapped[PageKey] = mapped_column(
        Enum(PageKey, native_enum=False, values_callable=lambda e: [v.value for v in e]),
        primary_key=True,
    )
    template: Mapped[PageTemplate] = mapped_column(
        Enum(PageTemplate, native_enum=False, values_callable=lambda e: [v.value for v in e])
    )


class PageLocale(Base):
    __tablename__ = "page_locales"
    __table_args__ = (UniqueConstraint("page_key", "locale", name="uq_page_locale"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    page_key: Mapped[str] = mapped_column(ForeignKey("pages.key"))
    locale: Mapped[str] = mapped_column(String(2))
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    indexable: Mapped[bool] = mapped_column(Boolean, default=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
