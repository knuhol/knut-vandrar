"""Register all ORM models for API, migration, and standalone command entry points."""

from knut_vandrar_backend.models import (
    hike,
    location,
    media,
    page,
    photo,
    reference,
    track,
    translation,
)

__all__ = ["hike", "reference", "location", "translation", "photo", "media", "page", "track"]
