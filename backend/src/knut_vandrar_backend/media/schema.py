"""Versioned, environment-independent media archive records."""

from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from knut_vandrar_backend.media.storage import PHOTO_FILES
from knut_vandrar_backend.models.enums import TranslationReviewStatus

FORMAT_VERSION: Literal[1] = 1
MAX_RECORD_BYTES = 1024 * 1024
MAX_FILE_BYTES = 25_000_000
DEFAULT_MAX_BYTES = 100 * 1024**3
CHUNK_BYTES = 1024 * 1024


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Manifest(Record):
    format: Literal["knut-vandrar-media"] = "knut-vandrar-media"
    version: Literal[1] = FORMAT_VERSION
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
    kind: Literal["photo", "cover", "logo"]
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
        elif self.id != self.owner_id or set(self.files) != {"image"} or self.translations:
            raise ValueError("Covers/logos require an owner ID and a single image")
        return self

    def file_path(self, variant: str) -> str:
        return f"{self.kind}/{self.id}/{variant}"
