"""Shared API payloads, images, and translation requests for tests."""

from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import cast

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.translation import TranslationJob

TEST_WRITE_TOKEN = "test-write-token-" + "a" * 32


def _png_image(size: tuple[int, int]) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, (20, 100, 180)).save(output, format="PNG")
    return output.getvalue()


def _planned_payload(**overrides: object) -> dict[str, object]:
    start = datetime(2026, 5, 1, 9, tzinfo=UTC)
    payload: dict[str, object] = {
        "status": "planned",
        "planned_start_at": start.isoformat(),
        "planned_end_at": (start + timedelta(days=13, hours=23)).isoformat(),
        "english": {
            "title": "Hike through the Highlands",
            "tagline": "A few days outside",
            "summary_markdown": "A short summary reused on both pages.",
            "description_markdown": "## The plan\n\nFollow the trail.",
        },
        "cards": [{"type": "route", "url": "https://example.com/route.gpx"}],
    }
    payload.update(overrides)
    return payload


def _db_session(client: TestClient) -> Session:
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    return factory()


def _get_jobs(client: TestClient) -> list[dict[str, object]]:
    db = _db_session(client)
    jobs = db.scalars(select(TranslationJob)).all()
    result: list[dict[str, object]] = [{"target_locale": job.target_locale} for job in jobs]
    db.close()
    return result


def _request_translations(client: TestClient, kind: str, entity_id: str) -> None:
    response = client.post(
        "/api/translations/requeue",
        json={
            "include_outdated": True,
            "entity_type": kind,
            "entity_id": entity_id,
            "locale": "sv",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["queued"] == 1
