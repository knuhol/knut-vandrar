"""FastAPI application configuration."""

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from typing import Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from knut_vandrar_backend.api.auth import READ_METHODS, require_write_auth
from knut_vandrar_backend.api.authored import (
    achievements_router,
    geographic_labels_router,
    regions_router,
    translation_router,
)
from knut_vandrar_backend.api.discovery import router as discovery_router
from knut_vandrar_backend.api.health import router as health_router
from knut_vandrar_backend.api.hikes import router as hikes_router
from knut_vandrar_backend.api.locations import router as locations_router
from knut_vandrar_backend.api.pages import admin_router as page_admin_router
from knut_vandrar_backend.api.pages import router as pages_router
from knut_vandrar_backend.api.photos import router as photos_router
from knut_vandrar_backend.api.tracking import router as tracking_router
from knut_vandrar_backend.api.tracking import settings_router as tracking_settings_router
from knut_vandrar_backend.api.tracks import router as tracks_router
from knut_vandrar_backend.api.translations import router as translations_router
from knut_vandrar_backend.database.session import engine
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.tracking.worker import poll


async def poll_garmin(stop: asyncio.Event) -> None:
    while not stop.is_set():
        with suppress(TimeoutError):
            await asyncio.wait_for(stop.wait(), timeout=15)
        if stop.is_set():
            break
        try:
            await asyncio.to_thread(poll)
        except Exception:
            logging.getLogger(__name__).error("Garmin synchronization failed")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Release SQLAlchemy pooled connections when the application stops."""
    stop = asyncio.Event()
    worker = asyncio.create_task(poll_garmin(stop))
    try:
        yield
    finally:
        stop.set()
        await worker
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


@app.middleware("http")
async def indexing_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    # Public image responses remain indexable; JSON endpoints are data, not pages.
    if response.headers.get("content-type", "").startswith("application/json"):
        response.headers["X-Robots-Tag"] = "noindex"
    return response


app.include_router(photos_router)
app.include_router(discovery_router)
app.include_router(tracking_router)
app.include_router(tracking_settings_router)
app.include_router(hikes_router)
app.include_router(tracks_router)
app.include_router(locations_router)
app.include_router(health_router)


app.include_router(regions_router)
app.include_router(geographic_labels_router)
app.include_router(achievements_router)
for content_type, prefix in [
    ("photo", "/api/photos"),
    ("location", "/api/locations"),
    ("region", "/api/regions"),
    ("hike_geographic_label", "/api/hike-geographic-labels"),
    ("achievement", "/api/achievements"),
]:
    app.include_router(translation_router(content_type, prefix))

app.include_router(translations_router)

app.include_router(pages_router)
app.include_router(page_admin_router)
