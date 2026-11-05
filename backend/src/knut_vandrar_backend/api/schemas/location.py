"""Request and response schemas for saved locations."""

from pydantic import BaseModel, ConfigDict


class LocationCreate(BaseModel):
    """Fields accepted when creating a saved location."""

    name: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    visited: bool = False


class LocationRead(LocationCreate):
    """Location representation returned by the API."""

    id: int
    created_at: int | None = None

    model_config = ConfigDict(from_attributes=True)
