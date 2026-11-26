"""Durable Garmin fixes and per-hike synchronization state."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, false
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base


class GarminPoint(Base):
    __tablename__ = "garmin_points"
    __table_args__ = (Index("ix_garmin_points_hike_time", "hike_id", "recorded_at"),)

    hike_id: Mapped[UUID] = mapped_column(
        ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    data: Mapped[dict[str, Any]] = mapped_column(JSON)


class GarminSync(Base):
    __tablename__ = "garmin_sync"

    hike_id: Mapped[UUID] = mapped_column(
        ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    succeeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    covered_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retry_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GarminSettings(Base):
    __tablename__ = "garmin_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    password: Mapped[str] = mapped_column(String(256))
    active: Mapped[bool] = mapped_column(default=False, server_default=false())
