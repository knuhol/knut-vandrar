"""Gallery metadata; image files live in private persistent storage."""

from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.models.location import Authored, Localized


class Photo(Authored, Base):
    __tablename__ = "hike_photos"
    __table_args__ = (Index("ix_hike_photos_order", "hike_id", "sort_order", "id"),)
    hike_id: Mapped[UUID] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    original_type: Mapped[str] = mapped_column(String(100))
    digest: Mapped[str] = mapped_column(String(64))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)


class PhotoTranslation(Localized, Base):
    __tablename__ = "photo_translations"
    photo_id: Mapped[UUID] = mapped_column(
        ForeignKey("hike_photos.id", ondelete="CASCADE"), primary_key=True
    )
    caption: Mapped[str | None] = mapped_column(Text)
    alt: Mapped[str] = mapped_column(String(1000))
