"""SQLAlchemy model for a saved travel location."""

from sqlalchemy import Boolean, Float, Integer, String, false
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    visited: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=false(),
        nullable=False,
    )
    created_at: Mapped[int | None] = mapped_column(Integer, nullable=True)
