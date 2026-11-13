"""FastAPI application configuration."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from knut_vandrar_backend.api.auth import READ_METHODS, require_write_auth
from knut_vandrar_backend.api.authored import (
    achievements_router,
    regions_router,
    translation_router,
)
from knut_vandrar_backend.api.health import router as health_router
from knut_vandrar_backend.api.hikes import router as hikes_router
from knut_vandrar_backend.api.locations import router as locations_router
from knut_vandrar_backend.api.photos import router as photos_router
from knut_vandrar_backend.api.translations import router as translations_router
from knut_vandrar_backend.database.session import engine
from knut_vandrar_backend.settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Release SQLAlchemy pooled connections when the application stops."""
    yield
    engine.dispose()


class BackendAPI(FastAPI):
    """Document the global write policy without marking public reads as protected."""

    def openapi(self) -> dict[str, Any]:
        schema = super().openapi()
        for path in schema.get("paths", {}).values():
            for method, operation in path.items():
                if method.upper() in READ_METHODS and not operation.get("x-admin-only"):
                    operation.pop("security", None)
                elif method.upper() in {"POST", "PUT", "PATCH", "DELETE"} or operation.get(
                    "x-admin-only"
                ):
                    responses = operation.setdefault("responses", {})
                    responses.setdefault("401", {"description": "Missing or invalid Bearer token"})
                    responses.setdefault(
                        "503", {"description": "API write access is not configured"}
                    )
        return schema


app = BackendAPI(
    title="knut-vandrar API",
    version="0.1.0",
    lifespan=lifespan,
    dependencies=[Depends(require_write_auth)],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(photos_router)
app.include_router(hikes_router)
app.include_router(locations_router)
app.include_router(health_router)


app.include_router(regions_router)
app.include_router(achievements_router)
for content_type, prefix in [
    ("photo", "/api/photos"),
    ("location", "/api/locations"),
    ("region", "/api/regions"),
    ("achievement", "/api/achievements"),
]:
    app.include_router(translation_router(content_type, prefix))

app.include_router(translations_router)
