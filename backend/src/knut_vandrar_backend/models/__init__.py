"""Register all ORM models for API, migration, and standalone command entry points."""

from knut_vandrar_backend.models import hike, location, reference, translation

__all__ = ["hike", "reference", "location", "translation"]
