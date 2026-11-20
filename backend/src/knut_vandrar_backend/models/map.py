"""Generated map variants, separate from editorial gallery and cover images."""

from typing import Any
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base


class HikeMapImage(Base):
    __tablename__ = "hike_map_images"
    __table_args__ = (CheckConstraint("width > 0 AND height > 0", name="ck_map_dimensions"),)

    hike_id: Mapped[UUID] = mapped_column(
        ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
    )
    variant: Mapped[str] = mapped_column(String(40), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[int] = mapped_column(nullable=False)
    height: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
