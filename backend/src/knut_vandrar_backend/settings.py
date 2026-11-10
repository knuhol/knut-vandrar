"""Validated, centralized backend settings."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url

# Root .env supplies host development values; Compose-injected variables win.
load_dotenv()


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Required configuration variable {name} is not set")
    return value


def _port(name: str) -> int:
    try:
        value = int(_required(name))
    except ValueError as exc:
        raise RuntimeError(f"Configuration variable {name} must be an integer port") from exc
    if not 1 <= value <= 65535:
        raise RuntimeError(f"Configuration variable {name} must be between 1 and 65535")
    return value


def _database_url() -> URL:
    """Use the local URL on the host; derive the service URL in Compose."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        url = make_url(database_url)
        if not url.drivername.startswith("postgresql") or not url.host or not url.database:
            raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL")
        if url.drivername == "postgresql":
            url = url.set(drivername="postgresql+psycopg2")
        return url.set(port=_port("POSTGRES_PORT"))

    return URL.create(
        "postgresql+psycopg2",
        username=_required("POSTGRES_USER"),
        password=_required("POSTGRES_PASSWORD"),
        host=_required("DATABASE_SERVICE_HOST"),
        port=_port("POSTGRES_INTERNAL_PORT"),
        database=_required("POSTGRES_DATABASE"),
    )


@dataclass(frozen=True)
class Settings:
    database_url: URL
    cors_origins: tuple[str, ...]
    api_host: str
    api_port: int
    frontend_revalidation_url: str | None
    cache_revalidation_secret: str | None
    openai_api_key: str | None


def load_settings() -> Settings:
    origins = tuple(
        origin.strip() for origin in _required("CORS_ORIGINS").split(",") if origin.strip()
    )
    if not origins:
        raise RuntimeError("CORS_ORIGINS must contain at least one allowed origin")
    return Settings(
        database_url=_database_url(),
        cors_origins=origins,
        api_host=_required("API_HOST"),
        api_port=_port("API_PORT"),
        frontend_revalidation_url=os.getenv("FRONTEND_REVALIDATION_URL", "").strip() or None,
        cache_revalidation_secret=os.getenv("CACHE_REVALIDATION_SECRET", "").strip() or None,
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip() or None,
    )


settings = load_settings()
