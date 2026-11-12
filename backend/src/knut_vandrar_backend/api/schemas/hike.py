"""Request and response schemas for hikes and optional information cards."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from knut_vandrar_backend.api.schemas.location import AchievementRead, LocationRead
from knut_vandrar_backend.models.enums import (
    AccommodationType,
    Direction,
    HikeStatus,
    RouteScope,
    TranslationReviewStatus,
)


class StrictCardModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RouteCard(StrictCardModel):
    type: Literal["route"]
    url: HttpUrl


class ProgressCard(StrictCardModel):
    type: Literal["progress"]
    url: HttpUrl


class LivePositionCard(StrictCardModel):
    type: Literal["live_position"]
    state: Literal["active", "inactive"]
    url: HttpUrl | None = None


class EquipmentCard(StrictCardModel):
    type: Literal["equipment"]
    url: HttpUrl


class SocialFeedCard(StrictCardModel):
    type: Literal["social_feed"]
    url: HttpUrl


class YouTubeVideoCard(StrictCardModel):
    type: Literal["youtube_video"]
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def require_youtube_url(cls, value: HttpUrl) -> HttpUrl:
        if value.host not in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}:
            raise ValueError("The video URL must be hosted on YouTube")
        return value


InfoCard = Annotated[
    RouteCard | ProgressCard | LivePositionCard | EquipmentCard | SocialFeedCard | YouTubeVideoCard,
    Field(discriminator="type"),
]


class HikeEnglishContent(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    tagline: str | None = Field(default=None, max_length=500)
    summary_markdown: str = Field(min_length=1)
    description_markdown: str | None = None


class OvernightWrite(BaseModel):
    accommodation_type: AccommodationType
    night_count: int = Field(gt=0)


class HikeExtra(BaseModel):
    start_latitude: float | None = Field(default=None, ge=-90, le=90)
    start_longitude: float | None = Field(default=None, ge=-180, le=180)
    end_latitude: float | None = Field(default=None, ge=-90, le=90)
    end_longitude: float | None = Field(default=None, ge=-180, le=180)
    direction: Direction | None = None
    route_scope: RouteScope | None = None
    start_stage: int | None = Field(default=None, gt=0)
    end_stage: int | None = Field(default=None, gt=0)
    overnights_recorded_at: datetime | None = None
    overnights: list[OvernightWrite] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_pairs(self) -> "HikeExtra":
        for left, right in [
            (self.start_latitude, self.start_longitude),
            (self.end_latitude, self.end_longitude),
            (self.start_stage, self.end_stage),
        ]:
            if (left is None) != (right is None):
                raise ValueError("Coordinates and stage ranges must be supplied as pairs")
        if len({night.accommodation_type for night in self.overnights}) != len(self.overnights):
            raise ValueError("Overnight types must be unique")
        if self.overnights and self.overnights_recorded_at is None:
            raise ValueError("Recorded overnight counts require overnights_recorded_at")
        if self.overnights_recorded_at is not None and self.overnights_recorded_at.tzinfo is None:
            raise ValueError("Overnight recording timestamp must include timezone")
        return self


class HikeWrite(HikeExtra):
    location_id: UUID | None = None
    status: HikeStatus = HikeStatus.PLANNED
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    distance_km: float | None = Field(default=None, ge=0, le=999999.99)
    ascent_m: int | None = Field(default=None, ge=0)
    start_point: str | None = Field(default=None, max_length=300)
    end_point: str | None = Field(default=None, max_length=300)
    english: HikeEnglishContent
    cards: list[InfoCard] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_timestamps(self) -> "HikeWrite":
        timestamp_pairs = (
            (self.planned_start_at, self.planned_end_at),
            (self.actual_start_at, self.actual_end_at),
        )
        for start, end in timestamp_pairs:
            if (start is not None and start.tzinfo is None) or (
                end is not None and end.tzinfo is None
            ):
                raise ValueError("Hike timestamps must include a timezone")
            if start is not None and end is not None and end <= start:
                raise ValueError("An end timestamp must be later than its start timestamp")
        if self.status == "planned" and (
            self.planned_start_at is None or self.planned_end_at is None
        ):
            raise ValueError("Planned hikes require expected start and end timestamps")
        if self.status == "ongoing" and self.actual_start_at is None:
            raise ValueError("Ongoing hikes require an actual start timestamp")
        if self.status in {"completed", "aborted"} and (
            self.actual_start_at is None or self.actual_end_at is None
        ):
            raise ValueError("Completed and aborted hikes require actual start and end timestamps")
        return self


class HikeLocalizedRead(BaseModel):
    locale: str
    title: str
    tagline: str | None
    summary_markdown: str
    description_markdown: str | None
    slug: str
    review_status: TranslationReviewStatus
    is_outdated: bool


class HikeRead(HikeExtra):
    id: UUID
    location: LocationRead | None
    status: HikeStatus
    planned_start_at: datetime | None
    planned_end_at: datetime | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    distance_km: float | None
    ascent_m: int | None
    start_point: str | None
    end_point: str | None
    duration_days: int | None
    cover_image_url: str | None
    translation: HikeLocalizedRead
    cards: list[InfoCard]
    achievements: list[AchievementRead]
    created_at: datetime
    updated_at: datetime


class HikeSummaryRead(BaseModel):
    id: UUID
    location: LocationRead | None
    status: HikeStatus
    planned_start_at: datetime | None
    planned_end_at: datetime | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    distance_km: float | None
    ascent_m: int | None
    start_point: str | None
    end_point: str | None
    duration_days: int | None
    cover_image_url: str | None
    translation: HikeLocalizedRead


class HikeSlugRead(BaseModel):
    locale: str
    slug: str


class TranslationReviewWrite(BaseModel):
    review_status: Literal["unreviewed", "approved", "needs_retranslation", "manual"]
