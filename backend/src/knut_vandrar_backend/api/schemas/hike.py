"""Request and response schemas for hikes and optional information cards."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from knut_vandrar_backend.api.schemas.trail import TrailRead
from knut_vandrar_backend.models.enums import HikeStatus, TranslationReviewStatus


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


class HikeWrite(BaseModel):
    trail_id: UUID | None = None
    status: HikeStatus = HikeStatus.PLANNED
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    actual_start_at: datetime | None = None
    actual_end_at: datetime | None = None
    distance_km: int | None = Field(default=None, ge=0)
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


class HikeRead(BaseModel):
    id: UUID
    trail: TrailRead | None
    status: HikeStatus
    planned_start_at: datetime | None
    planned_end_at: datetime | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    distance_km: int | None
    ascent_m: int | None
    start_point: str | None
    end_point: str | None
    duration_days: int | None
    cover_image_url: str | None
    translation: HikeLocalizedRead
    cards: list[InfoCard]
    created_at: datetime
    updated_at: datetime


class HikeSummaryRead(BaseModel):
    id: UUID
    trail: TrailRead | None
    status: HikeStatus
    planned_start_at: datetime | None
    planned_end_at: datetime | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    distance_km: int | None
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
    review_status: Literal["unreviewed", "approved", "needs_retranslation"]
