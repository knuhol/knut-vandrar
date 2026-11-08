"""Trail API request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from knut_vandrar_backend.models.enums import TrailType


class TrailWrite(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: TrailType
    country_codes: list[str] = Field(min_length=1)
    official_url: HttpUrl | None = None

    @field_validator("country_codes")
    @classmethod
    def normalize_country_codes(cls, values: list[str]) -> list[str]:
        normalized = [value.strip().upper() for value in values]
        if any(
            len(value) != 2 or not value.isascii() or not value.isalpha() for value in normalized
        ):
            raise ValueError("Country codes must be two-letter ISO codes")
        if len(normalized) != len(set(normalized)):
            raise ValueError("A country may only be listed once")
        return normalized


class TrailRead(BaseModel):
    id: UUID
    name: str
    type: TrailType
    country_codes: list[str]
    official_url: str | None
    logo_url: str | None = Field(
        description="Backend URL for this trail's logo, when one has been uploaded."
    )
