"""Typed contracts for destinations, regions and manually authored achievements."""

from datetime import date
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, model_validator

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


class LocationEnglish(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    season_note: str | None = None
    overnight_restrictions_note: str | None = None


class RegionEnglish(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class AchievementEnglish(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None


class RatingWrite(BaseModel):
    facilities: int | None = Field(default=None, ge=0, le=10)
    maintenance: int | None = Field(default=None, ge=0, le=10)
    resupplies: int | None = Field(default=None, ge=0, le=10)
    public_transport: int | None = Field(default=None, ge=0, le=10)
    difficulty: int | None = Field(default=None, ge=0, le=10)
    assessed_at: date | None = None


class TranslationMetadata(BaseModel):
    locale: str
    review_status: TranslationReviewStatus
    is_outdated: bool


class RegionWrite(BaseModel):
    english: RegionEnglish


class RegionRead(RegionEnglish):
    id: UUID
    translation: TranslationMetadata


class AchievementWrite(BaseModel):
    hike_id: UUID
    icon: AchievementIcon
    sort_order: int = Field(default=0, ge=0)
    english: AchievementEnglish


class AchievementRead(AchievementEnglish):
    id: UUID
    hike_id: UUID
    icon: AchievementIcon
    sort_order: int
    translation: TranslationMetadata


class LocationWrite(BaseModel):
    kind: LocationKind = LocationKind.TRAIL
    english: LocationEnglish
    official_url: HttpUrl | None = None
    waymarking: Waymarking | None = None
    is_loop: bool | None = None
    arctic_circle_position: ArcticCirclePosition | None = None
    information_checked_at: date | None = None
    country_codes: list[str] = Field(min_length=1)
    terrains: list[TrailType] = Field(default_factory=list)
    region_ids: list[UUID] = Field(default_factory=list)
    hiking_months: list[int] | None = None
    water_sources_status: InformationStatus = InformationStatus.UNKNOWN
    water_sources: list[WaterSourceType] = Field(default_factory=list)
    overnight_options_status: InformationStatus = InformationStatus.UNKNOWN
    overnight_options: list[AccommodationType] = Field(default_factory=list)
    overnight_restrictions_status: InformationStatus = InformationStatus.UNKNOWN
    overnight_restrictions: list[RestrictionType] = Field(default_factory=list)
    ratings: RatingWrite | None = None

    @model_validator(mode="after")
    def validate_collections(self) -> "LocationWrite":
        self.country_codes = [code.strip().upper() for code in self.country_codes]
        if any(
            len(code) != 2 or not code.isascii() or not code.isalpha()
            for code in self.country_codes
        ):
            raise ValueError("Country codes must be two ASCII letters")
        collections: list[list[Any]] = [
            self.country_codes,
            self.terrains,
            self.region_ids,
            self.water_sources,
            self.overnight_options,
            self.overnight_restrictions,
        ]
        if self.hiking_months is not None:
            if not self.hiking_months or any(
                month < 1 or month > 12 for month in self.hiking_months
            ):
                raise ValueError("Known hiking months must contain values from 1 to 12")
            collections.append(self.hiking_months)
        if any(len(items) != len(set(items)) for items in collections):
            raise ValueError("Collection values must be unique")
        for status, values in [
            (self.water_sources_status, self.water_sources),
            (self.overnight_options_status, self.overnight_options),
            (self.overnight_restrictions_status, self.overnight_restrictions),
        ]:
            if status == InformationStatus.UNKNOWN and values:
                raise ValueError("Unknown information cannot have recorded options")
        if self.kind == LocationKind.AREA and self.is_loop is not None:
            raise ValueError("Loop status applies only to trails")
        return self


class LocationRead(LocationEnglish):
    id: UUID
    kind: LocationKind
    official_url: str | None
    logo_url: str | None
    waymarking: Waymarking | None
    is_loop: bool | None
    arctic_circle_position: ArcticCirclePosition | None
    information_checked_at: date | None
    country_codes: list[str]
    terrains: list[TrailType]
    regions: list[RegionRead]
    hiking_months: list[int] | None
    water_sources_status: InformationStatus
    water_sources: list[WaterSourceType]
    overnight_options_status: InformationStatus
    overnight_options: list[AccommodationType]
    overnight_restrictions_status: InformationStatus
    overnight_restrictions: list[RestrictionType]
    ratings: RatingWrite | None
    translation: TranslationMetadata
