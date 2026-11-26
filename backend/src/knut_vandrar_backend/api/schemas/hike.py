"""Request and response schemas for hikes and optional information cards."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from knut_vandrar_backend.api.schemas.location import (
    AchievementRead,
    LocationRead,
    TranslationMetadata,
)
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


class GpxCollectionCard(StrictCardModel):
    type: Literal["gpx_collection"]
    url: HttpUrl


class ProgressCard(StrictCardModel):
    type: Literal["progress"]
    url: HttpUrl


class LivePositionCard(StrictCardModel):
    type: Literal["live_position"]
    state: Literal["active", "inactive"]


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
    RouteCard
    | GpxCollectionCard
    | ProgressCard
    | EquipmentCard
    | SocialFeedCard
    | YouTubeVideoCard,
    Field(discriminator="type"),
]


class HikeGeographicLabelContent(BaseModel):
    geographic_label: str | None = Field(default=None, max_length=160)

    @field_validator("geographic_label", mode="before")
    @classmethod
    def normalize_geographic_label(cls, value: object) -> object:
        if isinstance(value, str):
            return " ".join(value.split()) or None
        return value


class HikeGeographicLabelRead(HikeGeographicLabelContent):
    id: UUID
    translation: TranslationMetadata


class HikeEnglishContent(HikeGeographicLabelContent):
    title: str = Field(min_length=1, max_length=240)
    tagline: str | None = Field(default=None, max_length=500)
    summary_markdown: str = Field(min_length=1)
    description_markdown: str | None = None


class OvernightWrite(BaseModel):
    accommodation_type: AccommodationType
    night_count: int = Field(gt=0)


class HikeExtra(BaseModel):
    stop_latitude: float | None = Field(
        default=None,
        ge=-90,
        le=90,
        allow_inf_nan=False,
        description="Stopping latitude for an aborted hike. Clear both stopping coordinates to remove it.",
    )
    stop_longitude: float | None = Field(
        default=None,
        ge=-180,
        le=180,
        allow_inf_nan=False,
        description="Stopping longitude; projected onto the selected GPX route during generation.",
    )
    stop_stage: str | None = Field(
        default=None,
        min_length=1,
        max_length=40,
        pattern=r"^\d+(?:[A-Za-z]+|(?:\.\d+)+)?$",
        description="Optional GPX stage label, such as 11 or 11B, to disambiguate nearby stages.",
    )
    start_latitude: float | None = Field(default=None, ge=-90, le=90)
    start_longitude: float | None = Field(default=None, ge=-180, le=180)
    end_latitude: float | None = Field(default=None, ge=-90, le=90)
    end_longitude: float | None = Field(default=None, ge=-180, le=180)
    direction: Direction | None = None
    route_scope: RouteScope | None = None
    is_loop: bool | None = None
    named_route_name: str | None = Field(default=None, min_length=1, max_length=200)
    named_route_url: HttpUrl | None = Field(default=None, max_length=2048)
    start_stage: int | None = Field(default=None, gt=0)
    end_stage: int | None = Field(default=None, gt=0)
    overnights_recorded_at: datetime | None = None
    overnights: list[OvernightWrite] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_pairs(self) -> "HikeExtra":
        for left, right in [
            (self.stop_latitude, self.stop_longitude),
            (self.start_latitude, self.start_longitude),
            (self.end_latitude, self.end_longitude),
            (self.start_stage, self.end_stage),
        ]:
            if (left is None) != (right is None):
                raise ValueError("Coordinates and stage ranges must be supplied as pairs")
        if self.stop_stage is not None and self.stop_latitude is None:
            raise ValueError("A stopping stage requires stopping coordinates")
        if len({night.accommodation_type for night in self.overnights}) != len(self.overnights):
            raise ValueError("Overnight types must be unique")
        if self.overnights and self.overnights_recorded_at is None:
            raise ValueError("Recorded overnight counts require overnights_recorded_at")
        if self.overnights_recorded_at is not None and self.overnights_recorded_at.tzinfo is None:
            raise ValueError("Overnight recording timestamp must include timezone")
        return self


class HikeWrite(HikeExtra):
    track_collection_id: UUID | None = None
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
    cards: list[InfoCard] = Field(
        default_factory=list,
        description="At most one information card of each type per hike.",
        json_schema_extra={"x-unique-by": "type"},
    )

    @field_validator("cards")
    @classmethod
    def validate_card_types(cls, cards: list[InfoCard]) -> list[InfoCard]:
        seen: set[str] = set()
        for card in cards:
            if card.type in seen:
                raise ValueError(f"Only one information card of each type is allowed: {card.type}")
            seen.add(card.type)
        return cards

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
    geographic_label: str | None = None
    slug: str
    review_status: TranslationReviewStatus
    is_outdated: bool


class HikeSlugRead(BaseModel):
    locale: str
    slug: str


class OngoingHikeRead(HikeSlugRead):
    id: UUID


class HikeDiscoveryRead(BaseModel):
    id: UUID
    translations: list[HikeSlugRead]


class HikeNeighborRead(BaseModel):
    id: UUID
    title: str
    slug: str


class HikeNeighborsRead(BaseModel):
    previous: HikeNeighborRead | None
    next: HikeNeighborRead | None


class HikeCoverSources(BaseModel):
    full: str
    desktop: str | None = None
    wide: str | None = None
    mobile: str
    card: str


class HikeRead(HikeExtra):
    track_collection_id: UUID | None = None
    id: UUID
    english_title: str | None
    has_geographic_label: bool = False
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
    cover_sources: HikeCoverSources | None = None
    translation: HikeLocalizedRead
    available_translations: list[HikeSlugRead]
    cards: list[InfoCard]
    live_tracking: LivePositionCard | None = None
    mapshare_url: HttpUrl | None = None
    mapshare_password: str | None = None
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
    cover_sources: HikeCoverSources | None = None
    translation: HikeLocalizedRead


class TranslationReviewWrite(BaseModel):
    review_status: Literal["unreviewed", "approved", "needs_retranslation", "manual"]
