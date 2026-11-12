"""Reusable hiking destinations, practical information and authored achievements."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.models.enums import (
    AccommodationType,
    AchievementIcon,
    ArcticCirclePosition,
    InformationStatus,
    LocationKind,
    RestrictionType,
    TrailType,
    TranslationReviewStatus,
    WaterSourceType,
    Waymarking,
)


def enum_type(kind: type[StrEnum], name: str) -> Enum:
    return Enum(
        kind,
        name=name,
        values_callable=lambda values: [value.value for value in values],
        validate_strings=True,
    )


class Audit:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Authored(Audit):
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    source_revision: Mapped[int] = mapped_column(Integer, default=1)


class Localized(Audit):
    locale_code: Mapped[str] = mapped_column(
        ForeignKey("languages.code", ondelete="RESTRICT"), primary_key=True
    )
    source_revision: Mapped[int] = mapped_column(Integer, default=1)
    review_status: Mapped[TranslationReviewStatus] = mapped_column(
        enum_type(TranslationReviewStatus, "translation_review_status"),
        default=TranslationReviewStatus.UNREVIEWED,
    )
    profile_fingerprint: Mapped[str | None] = mapped_column(String(64))
    provider: Mapped[str | None] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(120))
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class HikingLocation(Authored, Base):
    __tablename__ = "hiking_locations"
    kind: Mapped[LocationKind] = mapped_column(
        enum_type(LocationKind, "location_kind"), default=LocationKind.TRAIL
    )
    official_url: Mapped[str | None] = mapped_column(String(2048))
    waymarking: Mapped[Waymarking | None] = mapped_column(enum_type(Waymarking, "waymarking"))
    is_loop: Mapped[bool | None] = mapped_column(Boolean)
    arctic_circle_position: Mapped[ArcticCirclePosition | None] = mapped_column(
        enum_type(ArcticCirclePosition, "arctic_circle_position")
    )
    hiking_months_known: Mapped[bool] = mapped_column(Boolean, default=False)
    information_checked_at: Mapped[date | None] = mapped_column(Date)
    water_sources_status: Mapped[InformationStatus] = mapped_column(
        enum_type(InformationStatus, "information_status"), default=InformationStatus.UNKNOWN
    )
    overnight_options_status: Mapped[InformationStatus] = mapped_column(
        enum_type(InformationStatus, "information_status"), default=InformationStatus.UNKNOWN
    )
    overnight_restrictions_status: Mapped[InformationStatus] = mapped_column(
        enum_type(InformationStatus, "information_status"), default=InformationStatus.UNKNOWN
    )
    __table_args__ = (
        CheckConstraint("kind = 'trail' OR is_loop IS NULL", name="ck_location_area_loop"),
    )


class LocationTranslation(Localized, Base):
    __tablename__ = "location_translations"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    name: Mapped[str] = mapped_column(String(200))
    season_note: Mapped[str | None] = mapped_column(Text)
    overnight_restrictions_note: Mapped[str | None] = mapped_column(Text)


class Region(Authored, Base):
    __tablename__ = "regions"


class RegionTranslation(Localized, Base):
    __tablename__ = "region_translations"
    region_id: Mapped[UUID] = mapped_column(
        ForeignKey("regions.id", ondelete="CASCADE"), primary_key=True
    )
    name: Mapped[str] = mapped_column(String(200))


class HikeAchievement(Authored, Base):
    __tablename__ = "hike_achievements"
    hike_id: Mapped[UUID] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"), index=True)
    icon: Mapped[AchievementIcon] = mapped_column(enum_type(AchievementIcon, "achievement_icon"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (CheckConstraint("sort_order >= 0", name="ck_achievement_order"),)


class AchievementTranslation(Localized, Base):
    __tablename__ = "achievement_translations"
    achievement_id: Mapped[UUID] = mapped_column(
        ForeignKey("hike_achievements.id", ondelete="CASCADE"), primary_key=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)


class LocationLogo(Base):
    __tablename__ = "location_logos"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    content_type: Mapped[str] = mapped_column(String(100))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    sha256: Mapped[str] = mapped_column(String(64))


class LocationRating(Audit, Base):
    __tablename__ = "location_ratings"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    assessed_at: Mapped[date | None] = mapped_column(Date)
    facilities: Mapped[int | None] = mapped_column(SmallInteger)
    maintenance: Mapped[int | None] = mapped_column(SmallInteger)
    resupplies: Mapped[int | None] = mapped_column(SmallInteger)
    public_transport: Mapped[int | None] = mapped_column(SmallInteger)
    difficulty: Mapped[int | None] = mapped_column(SmallInteger)
    __table_args__ = (
        CheckConstraint("facilities BETWEEN 0 AND 10", name="ck_rating_facilities"),
        CheckConstraint("maintenance BETWEEN 0 AND 10", name="ck_rating_maintenance"),
        CheckConstraint("resupplies BETWEEN 0 AND 10", name="ck_rating_resupplies"),
        CheckConstraint("public_transport BETWEEN 0 AND 10", name="ck_rating_public_transport"),
        CheckConstraint("difficulty BETWEEN 0 AND 10", name="ck_rating_difficulty"),
    )


class LocationCountry(Base):
    __tablename__ = "location_countries"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    country_code: Mapped[str] = mapped_column(String(2), primary_key=True)
    __table_args__ = (CheckConstraint("length(country_code) = 2", name="ck_location_countries"),)


class LocationTerrain(Base):
    __tablename__ = "location_terrains"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    terrain: Mapped[TrailType] = mapped_column(enum_type(TrailType, "trail_type"), primary_key=True)


class LocationWaterSource(Base):
    __tablename__ = "location_water_sources"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    source_type: Mapped[WaterSourceType] = mapped_column(
        enum_type(WaterSourceType, "water_source_type"), primary_key=True
    )


class LocationOvernightOption(Base):
    __tablename__ = "location_overnight_options"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    accommodation_type: Mapped[AccommodationType] = mapped_column(
        enum_type(AccommodationType, "accommodation_type"), primary_key=True
    )


class LocationRestriction(Base):
    __tablename__ = "location_overnight_restrictions"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    restriction_type: Mapped[RestrictionType] = mapped_column(
        enum_type(RestrictionType, "restriction_type"), primary_key=True
    )


class LocationMonth(Base):
    __tablename__ = "location_hiking_months"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    month: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    __table_args__ = (CheckConstraint("month BETWEEN 1 AND 12", name="ck_location_hiking_months"),)


class LocationRegion(Base):
    __tablename__ = "location_regions"
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("hiking_locations.id", ondelete="CASCADE"), primary_key=True
    )
    region_id: Mapped[UUID] = mapped_column(
        ForeignKey("regions.id", ondelete="RESTRICT"), primary_key=True
    )


class HikeOvernight(Base):
    __tablename__ = "hike_overnights"
    hike_id: Mapped[UUID] = mapped_column(
        ForeignKey("hikes.id", ondelete="CASCADE"), primary_key=True
    )
    accommodation_type: Mapped[AccommodationType] = mapped_column(
        enum_type(AccommodationType, "accommodation_type"), primary_key=True
    )
    night_count: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint("night_count > 0", name="ck_hike_overnights"),)
