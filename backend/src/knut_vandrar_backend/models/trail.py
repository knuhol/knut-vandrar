"""Named trails and their country membership."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, LargeBinary, String
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.models.enums import TrailType

if TYPE_CHECKING:
    from knut_vandrar_backend.models.hike import Hike


class Trail(Base):
    __tablename__ = "trails"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[TrailType] = mapped_column(
        SqlEnum(
            TrailType,
            name="trail_type",
            values_callable=lambda values: [value.value for value in values],
            validate_strings=True,
        ),
        nullable=False,
    )
    official_url: Mapped[str | None] = mapped_column(String(2048))
    logo: Mapped[TrailLogo | None] = relationship(
        back_populates="trail", cascade="all, delete-orphan", uselist=False
    )
    hikes: Mapped[list[Hike]] = relationship(back_populates="trail")
    countries: Mapped[list[TrailCountry]] = relationship(
        back_populates="trail", cascade="all, delete-orphan"
    )


class TrailCountry(Base):
    __tablename__ = "trail_countries"
    __table_args__ = (CheckConstraint("length(country_code) = 2"),)

    trail_id: Mapped[UUID] = mapped_column(
        ForeignKey("trails.id", ondelete="CASCADE"), primary_key=True
    )
    country_code: Mapped[str] = mapped_column(String(2), primary_key=True)
    trail: Mapped[Trail] = relationship(back_populates="countries")


class TrailLogo(Base):
    __tablename__ = "trail_logos"

    trail_id: Mapped[UUID] = mapped_column(
        ForeignKey("trails.id", ondelete="CASCADE"), primary_key=True
    )
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    trail: Mapped[Trail] = relationship(back_populates="logo")
