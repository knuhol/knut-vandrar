"""Validated, centralized backend settings."""

import os
import re
from dataclasses import dataclass, field

from dotenv import load_dotenv
from pydantic import SecretStr
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


def _openai_timeout() -> int:
    name = "OPENAI_REQUEST_TIMEOUT_SECONDS"
    try:
        value = int(os.getenv(name, "600"))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return value


def _write_token() -> SecretStr | None:
    value = os.getenv("API_WRITE_TOKEN", "").strip()
    if not value:
        return None
    if re.fullmatch(r"[A-Za-z0-9_-]{43,128}", value) is None:
        raise RuntimeError(
            "API_WRITE_TOKEN must be a randomly generated URL-safe token of 43–128 characters"
        )
    return SecretStr(value)


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
    openai_api_key: str | None
    openai_request_timeout_seconds: int
    api_write_token: SecretStr | None = field(repr=False)


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
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip() or None,
        openai_request_timeout_seconds=_openai_timeout(),
        api_write_token=_write_token(),
    )


settings = load_settings()
