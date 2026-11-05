"""FastAPI application configuration."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from knut_vandrar_backend.api.health import router as health_router
from knut_vandrar_backend.api.locations import router as locations_router
from knut_vandrar_backend.database.session import engine
from knut_vandrar_backend.settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Release SQLAlchemy pooled connections when the application stops."""
    yield
    engine.dispose()


app = FastAPI(title="Knut vandrar API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(locations_router)
app.include_router(health_router)
