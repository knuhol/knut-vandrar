"""Register all ORM models for API, migration, and standalone command entry points."""

from knut_vandrar_backend.models import hike, reference, trail, translation

__all__ = ["hike", "reference", "trail", "translation"]
