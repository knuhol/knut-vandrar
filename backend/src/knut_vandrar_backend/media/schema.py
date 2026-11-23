"""Versioned, environment-independent media archive records."""

import re
from datetime import datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from knut_vandrar_backend.media.storage import PHOTO_FILES
from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import COVER_ASSET_NAMES
from knut_vandrar_backend.tracks.sources import TRACK_SOURCE_ID_PATTERN

FORMAT_VERSION: Literal[5] = 5
MAX_RECORD_BYTES = 1024 * 1024
MAX_FILE_BYTES = 25_000_000
DEFAULT_MAX_BYTES = 100 * 1024**3
CHUNK_BYTES = 1024 * 1024


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Manifest(Record):
    format: Literal["knut-vandrar-media"] = "knut-vandrar-media"
    version: Literal[1, 2, 3, 4, 5] = FORMAT_VERSION
    schema_revision: str = Field(min_length=1, max_length=100)


class ImageFile(Record):
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    size: int = Field(gt=0, le=MAX_FILE_BYTES)


class PhotoText(Record):
    locale_code: str = Field(pattern=r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$")
    alt: str = Field(max_length=1000)
    caption: str | None = Field(max_length=5000)
    source_revision: int = Field(ge=1)
    review_status: TranslationReviewStatus
    profile_fingerprint: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    provider: str | None = Field(default=None, max_length=60)
    model: str | None = Field(default=None, max_length=120)
    generated_at: datetime | None = None


class Asset(Record):
    kind: Literal["photo", "cover", "logo", "collection", "gpx", "track_selection", "map"]
    map_data: dict[str, Any] = Field(default_factory=dict)
    track_owner: Literal["trail", "hike"] = "trail"
    track_data: dict[str, Any] = Field(default_factory=dict)
    id: UUID
    owner_id: UUID
    content_type: str = Field(max_length=100)
    files: dict[str, ImageFile]
    sort_order: int = Field(default=0, ge=0)
    source_revision: int = Field(default=1, ge=1)
    width: int = Field(default=0, ge=0, le=40_000_000)
    height: int = Field(default=0, ge=0, le=40_000_000)
    translations: list[PhotoText] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_asset(self) -> Self:
        if self.kind == "map":
            from knut_vandrar_backend.maps.assets import MapData

            data = MapData.model_validate(self.map_data)
            if (
                self.id != self.owner_id
                or self.content_type != "image/webp"
                or self.translations
                or self.track_data
                or set(self.files) != set(data.variants)
                or any(not re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", key) for key in self.files)
            ):
                raise ValueError("Invalid generated map asset")
            return self
        if self.map_data:
            raise ValueError("Only map assets can contain map metadata")
        if self.kind in {"collection", "gpx", "track_selection"}:
            if self.translations:
                raise ValueError("Track assets cannot contain photo translations")
            if self.kind == "track_selection":
                if (
                    self.files
                    or self.content_type != "application/json"
                    or self.id != self.owner_id
                    or self.track_owner != "hike"
                ):
                    raise ValueError("Collection selections require a hike owner and metadata only")
                SelectionData.model_validate(self.track_data)
            elif self.kind == "collection":
                if self.files or self.content_type != "application/json":
                    raise ValueError("Collections contain metadata only")
                collection = CollectionData.model_validate(self.track_data)
                if self.track_owner == "trail" and collection.direction is None:
                    raise ValueError("Trail collections require a direction")
            else:
                if set(self.files) != {"track"} or self.content_type != "application/gpx+xml":
                    raise ValueError("GPX assets require a track file")
                RouteData.model_validate(self.track_data)
            return self
        if self.track_data:
            raise ValueError("Image assets cannot contain track metadata")
        if self.content_type not in {
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "image/svg+xml",
            "image/heic",
            "image/heif",
        }:
            raise ValueError("Unsupported image content type")
        if self.kind == "photo":
            if set(self.files) != set(PHOTO_FILES):
                raise ValueError("A photo requires original, thumbnail, and fullscreen files")
            if self.width < 1 or self.height < 1 or self.width * self.height > 40_000_000:
                raise ValueError("Invalid photo dimensions")
            locales = [text.locale_code for text in self.translations]
            if len(set(locales)) != len(locales) or "en" not in locales:
                raise ValueError("Photos require unique translations including English")
            for text in self.translations:
                if text.source_revision > self.source_revision:
                    raise ValueError("Translation revision exceeds photo source revision")
                if text.locale_code == "en" and (
                    text.source_revision != self.source_revision
                    or text.review_status != TranslationReviewStatus.SOURCE
                ):
                    raise ValueError("English must describe the current source revision")
        else:
            allowed = {"image", *COVER_ASSET_NAMES} if self.kind == "cover" else {"image"}
            if (
                self.id != self.owner_id
                or "image" not in self.files
                or not self.files.keys() <= allowed
                or self.translations
                or self.files.keys() & {"mobile", "card"}
                and self.content_type != "image/webp"
                or self.files.keys() & {"desktop", "wide"}
                and self.content_type == "image/svg+xml"
            ):
                raise ValueError("Invalid cover or location logo asset")
        return self

    def file_path(self, variant: str) -> str:
        return f"{self.kind}/{self.id}/{variant}"


class CollectionData(Record):
    source_id: str = Field(pattern=TRACK_SOURCE_ID_PATTERN)
    name: str = Field(min_length=1, max_length=300)
    direction: Literal["forward", "backward"] | None
    details: dict[str, Any]


class RouteData(Record):
    collection_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    source_id: str = Field(pattern=TRACK_SOURCE_ID_PATTERN)
    details: dict[str, Any]
    overrides: dict[str, Any]

    @model_validator(mode="after")
    def valid_collection(self) -> Self:
        UUID(self.collection_id)
        return self


class SelectionData(Record):
    collection_id: str = Field(pattern=r"^[0-9a-f-]{36}$")

    @model_validator(mode="after")
    def valid_collection(self) -> Self:
        UUID(self.collection_id)
        return self
