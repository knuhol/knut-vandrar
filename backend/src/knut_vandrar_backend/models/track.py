"""Trail- or hike-owned track collections and durable, unpublished import reviews."""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base


class TrackCollection(Base):
    __tablename__ = "track_collections"
    __table_args__ = (
        UniqueConstraint("location_id", "source_id"),
        UniqueConstraint("hike_id", "source_id"),
        CheckConstraint(
            "(location_id IS NULL) != (hike_id IS NULL)", name="ck_track_collection_owner"
        ),
        CheckConstraint("direction IN ('forward', 'backward')", name="ck_track_direction"),
        CheckConstraint(
            "(hike_id IS NOT NULL AND direction IS NULL) OR (location_id IS NOT NULL AND direction IS NOT NULL)",
            name="ck_track_direction_owner",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE")
    )
    hike_id: Mapped[UUID | None] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    source_id: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(300))
    direction: Mapped[str | None] = mapped_column(String(20))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class TrackRoute(Base):
    __tablename__ = "track_routes"
    __table_args__ = (UniqueConstraint("collection_id", "source_id"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    collection_id: Mapped[UUID] = mapped_column(
        ForeignKey("track_collections.id", ondelete="CASCADE")
    )
    source_id: Mapped[str] = mapped_column(String(40))
    details: Mapped[dict[str, Any]] = mapped_column(JSON)
    overrides: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    digest: Mapped[str] = mapped_column(String(64))


class TrackDraft(Base):
    __tablename__ = "track_drafts"
    __table_args__ = (
        UniqueConstraint("location_id", "source_id"),
        UniqueConstraint("hike_id", "source_id"),
        CheckConstraint("(location_id IS NULL) != (hike_id IS NULL)", name="ck_track_draft_owner"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE")
    )
    hike_id: Mapped[UUID | None] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    source_id: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict[str, Any]] = mapped_column(JSON)
