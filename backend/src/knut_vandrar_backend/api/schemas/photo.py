from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PhotoEnglish(BaseModel):
    model_config = ConfigDict(extra="forbid")
    alt: str = Field(default="", max_length=1000)
    caption: str | None = Field(default=None, max_length=5000)


class PhotoWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    english: PhotoEnglish


class PhotoRead(BaseModel):
    id: UUID
    hike_id: UUID
    sort_order: int
    width: int
    height: int
    thumbnail_url: str
    image_url: str
    alt: str
    caption: str | None
    translation: dict[str, str | bool]


class PhotoOrder(BaseModel):
    ids: list[UUID] = Field(min_length=1, max_length=10000)
