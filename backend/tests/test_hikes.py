"""API and queue tests for hiking content."""

import json
from collections.abc import Generator, Iterator
from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import Path
from typing import cast
from urllib.request import Request
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api.hikes import _duration_days
from knut_vandrar_backend.api.schemas.hike import RouteCard, YouTubeVideoCard
from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.models.reference import InfoCardType, Language
from knut_vandrar_backend.models.translation import TranslationJob, TranslationProfile
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.translations.cli import queue_outdated_translations
from knut_vandrar_backend.translations.core import profile_fingerprint
from knut_vandrar_backend.translations.openai_provider import TranslationResult


@pytest.fixture()
def client(tmp_path: Path) -> Iterator[TestClient]:
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker[Session](bind=engine, autoflush=False)
    app.state.testing_session_local = testing_session_local
    with testing_session_local.begin() as db:
        db.add_all(
            [
                Language(code="en", name="English", enabled=True, is_source=True),
                Language(code="sv", name="Swedish", enabled=True, is_source=False),
                Language(code="cs", name="Czech", enabled=True, is_source=False),
                InfoCardType(
                    type="route", sort_order=1, data_structure=RouteCard.model_json_schema()
                ),
                InfoCardType(
                    type="youtube_video",
                    sort_order=2,
                    data_structure=YouTubeVideoCard.model_json_schema(),
                ),
                TranslationProfile(
                    content_type="hike",
                    target_locale="sv",
                    instructions="Use natural Swedish.",
                    model="gpt-6-luna",
                ),
                TranslationProfile(
                    content_type="hike",
                    target_locale="cs",
                    instructions="Use natural Czech.",
                    model="gpt-6-luna",
                ),
            ]
        )

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


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


def test_hike_create_queues_translations_and_returns_typed_cards(client: TestClient) -> None:
    response = client.post("/api/hikes", json=_planned_payload())
    assert response.status_code == 201
    hike = response.json()
    assert hike["duration_days"] == 14
    assert hike["translation"]["slug"] == "hike-through-the-highlands"
    assert hike["cards"] == [{"type": "route", "url": "https://example.com/route.gpx"}]
    assert {job["target_locale"] for job in _get_jobs(client)} == {"sv", "cs"}


@pytest.mark.parametrize("locale", ["en", "sv", "cs"])
def test_hikes_are_ordered_by_start_date_before_pagination(client: TestClient, locale: str) -> None:
    earlier = datetime(2026, 5, 1, tzinfo=UTC)
    later = datetime(2026, 6, 1, tzinfo=UTC)
    db = _db_session(client)
    for index, (planned, actual) in enumerate(
        [(later, earlier), (earlier, later), (later, None), (earlier, None), (None, None)],
        start=1,
    ):
        hike = Hike(id=UUID(int=index), planned_start_at=planned, actual_start_at=actual)
        db.add(hike)
        db.flush()
        db.add(
            HikeTranslation(
                hike_id=hike.id,
                locale_code=locale,
                title=f"Hike {index}",
                summary_markdown="Summary",
                slug=f"hike-{index}",
                created_at=earlier + timedelta(days=index),
            )
        )
    db.commit()
    db.close()

    response = client.get("/api/hikes", params={"locale": locale})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [
        str(UUID(int=index)) for index in [2, 3, 1, 4, 5]
    ]

    page = client.get("/api/hikes", params={"locale": locale, "limit": 2, "offset": 1})
    assert page.status_code == 200
    assert page.json()["total"] == 5
    assert [item["id"] for item in page.json()["items"]] == [
        str(UUID(int=index)) for index in [3, 1]
    ]


def test_missing_translation_is_not_fallback_and_outdated_translation_is_served(
    client: TestClient,
) -> None:
    response = client.post("/api/hikes", json=_planned_payload())
    hike_id = response.json()["id"]
    assert client.get("/api/hikes?locale=sv").json() == {
        "items": [],
        "total": 0,
        "limit": 10,
        "offset": 0,
    }
    assert client.get("/api/hikes/sv/hike-through-the-highlands").status_code == 404

    hike_start = datetime.fromisoformat(response.json()["planned_start_at"])
    client.put(
        f"/api/hikes/{hike_id}",
        json=_planned_payload(
            english={
                "title": "Hike in the Mountains",
                "tagline": "Changed tagline",
                "summary_markdown": "Updated English summary.",
                "description_markdown": "Updated details.",
            },
            planned_start_at=hike_start.isoformat(),
        ),
    )
    # Insert an older published translation to prove localization wins while it refreshes.
    db = _db_session(client)
    hike = db.get(Hike, UUID(hike_id))
    assert hike is not None
    old = HikeTranslation(
        hike_id=hike.id,
        locale_code="sv",
        title="Gammal översättning",
        summary_markdown="Äldre sammanfattning.",
        slug="gammal-oversattning",
        source_revision=1,
        profile_fingerprint="old-profile",
        review_status="unreviewed",
    )
    db.add(old)
    db.commit()
    db.close()
    # Current English changed; the old Swedish copy is returned and identified as stale.
    localized = client.get("/api/hikes?locale=sv")
    assert localized.status_code == 200
    assert localized.json()["items"][0]["translation"]["title"] == "Gammal översättning"
    assert localized.json()["items"][0]["translation"]["is_outdated"] is True


def test_changing_a_title_keeps_the_old_localized_slug_as_redirect(client: TestClient) -> None:
    response = client.post("/api/hikes", json=_planned_payload())
    hike_id = response.json()["id"]
    previous_slug = response.json()["translation"]["slug"]

    updated = client.put(
        f"/api/hikes/{hike_id}",
        json=_planned_payload(
            english={
                "title": "A new title for the hike",
                "tagline": "A few days outside",
                "summary_markdown": "A short summary reused on both pages.",
                "description_markdown": "## The plan\n\nFollow the trail.",
            },
        ),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["translation"]["slug"] == "a-new-title-for-the-hike"

    redirect = client.get(f"/api/hikes/en/{previous_slug}", follow_redirects=False)
    assert redirect.status_code == 308
    assert redirect.headers["location"] == "/api/hikes/en/a-new-title-for-the-hike"


def test_trail_supports_multiple_countries_and_enum_type(client: TestClient) -> None:
    response = client.post(
        "/api/trails",
        json={
            "name": "The Border Trail",
            "type": "lowlands",
            "country_codes": ["se", "no"],
            "official_url": "https://example.com/trail",
        },
    )
    assert response.status_code == 201
    assert response.json()["type"] == "lowlands"
    assert response.json()["country_codes"] == ["NO", "SE"]


def test_trail_logo_is_stored_and_served_from_backend(client: TestClient) -> None:
    trail = client.post(
        "/api/trails",
        json={"name": "Test Trail", "type": "lowlands", "country_codes": ["se"]},
    ).json()
    assert trail["logo_url"] is None

    logo_bytes = _png_image((1024, 512))
    uploaded = client.put(
        f"/api/trails/{trail['id']}/logo",
        content=logo_bytes,
        headers={"Content-Type": "application/octet-stream"},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["logo_url"].endswith(f"/api/trails/{trail['id']}/logo")

    served = client.get(uploaded.json()["logo_url"])
    assert served.status_code == 200
    with Image.open(BytesIO(served.content)) as image:
        assert image.size == (512, 256)
        assert image.getpixel((0, 0)) == (20, 100, 180)
    assert served.headers["content-type"] == "image/webp"
    assert served.headers["x-content-type-options"] == "nosniff"
    cached = client.get(
        uploaded.json()["logo_url"], headers={"If-None-Match": served.headers["etag"]}
    )
    assert cached.status_code == 304

    deleted = client.delete(f"/api/trails/{trail['id']}/logo")
    assert deleted.status_code == 204
    assert client.get(f"/api/trails/{trail['id']}/logo").status_code == 404


def test_trail_logo_upload_rejects_unsupported_content(client: TestClient) -> None:
    trail = client.post(
        "/api/trails",
        json={"name": "Test Trail", "type": "lowlands", "country_codes": ["se"]},
    ).json()
    response = client.put(
        f"/api/trails/{trail['id']}/logo",
        content=b"not an image",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 415


def test_trail_logo_upload_rejects_oversized_body(client: TestClient) -> None:
    trail = client.post(
        "/api/trails",
        json={"name": "Test Trail", "type": "lowlands", "country_codes": ["se"]},
    ).json()
    response = client.put(
        f"/api/trails/{trail['id']}/logo",
        content=b"x" * (5 * 1024 * 1024 + 1),
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 413


def test_hike_points_youtube_card_and_cover_image(client: TestClient) -> None:
    payload = _planned_payload(
        start_point="Stenkälle gården",
        end_point="Kloten",
        cards=[{"type": "youtube_video", "url": "https://youtu.be/dQw4w9WgXcQ"}],
    )
    response = client.post("/api/hikes", json=payload)
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["start_point"] == "Stenkälle gården"
    assert hike["end_point"] == "Kloten"
    assert hike["cover_image_url"] is None
    assert hike["cards"] == [{"type": "youtube_video", "url": "https://youtu.be/dQw4w9WgXcQ"}]

    image_bytes = _png_image((2400, 1200))
    uploaded = client.put(
        f"/api/hikes/{hike['id']}/cover-image",
        content=image_bytes,
        headers={"Content-Type": "application/octet-stream"},
    )
    assert uploaded.status_code == 200, uploaded.text
    image_url = uploaded.json()["cover_image_url"]
    assert image_url.endswith(f"/api/hikes/{hike['id']}/cover-image")
    served = client.get(image_url)
    assert served.status_code == 200
    with Image.open(BytesIO(served.content)) as image:
        assert image.size == (1920, 960)
        assert image.format == "WEBP"
    assert served.headers["content-type"] == "image/webp"

    listed = client.get("/api/hikes?locale=en")
    assert listed.json()["items"][0]["cover_image_url"] == image_url

    deleted = client.delete(f"/api/hikes/{hike['id']}/cover-image")
    assert deleted.status_code == 204
    assert client.get(image_url).status_code == 404


def test_youtube_card_rejects_non_youtube_url(client: TestClient) -> None:
    payload = _planned_payload(
        cards=[{"type": "youtube_video", "url": "https://example.com/video"}]
    )
    assert client.post("/api/hikes", json=payload).status_code == 422


def test_card_schema_rejects_unknown_or_extra_config(client: TestClient) -> None:
    payload = _planned_payload(
        cards=[{"type": "route", "url": "https://example.com", "secret": "x"}]
    )
    assert client.post("/api/hikes", json=payload).status_code == 422


def test_duration_uses_actual_timestamps_and_rounds_up() -> None:
    hike = Hike(
        status=HikeStatus.COMPLETED,
        actual_start_at=datetime(2026, 1, 1, tzinfo=UTC),
        actual_end_at=datetime(2026, 1, 15, 1, tzinfo=UTC),
    )
    assert _duration_days(hike) == 15


def test_retranslation_command_only_queues_flagged_rows_once(client: TestClient) -> None:
    db = _db_session(client)
    hikes: list[Hike] = []
    for index in range(3):
        hike = Hike(status=HikeStatus.PLANNED)
        db.add(hike)
        db.flush()
        db.add(
            HikeTranslation(
                hike_id=hike.id,
                locale_code="en",
                title=f"Example hike {index}",
                summary_markdown="Summary",
                slug=f"example-hike-{index}",
                source_revision=1,
                review_status="source",
            )
        )
        hikes.append(hike)
    db.flush()
    _, sv_fingerprint = profile_fingerprint(db, "hike", "sv")
    _, cs_fingerprint = profile_fingerprint(db, "hike", "cs")
    db.add_all(
        [
            HikeTranslation(
                hike_id=hikes[1].id,
                locale_code="sv",
                title="Gammal",
                summary_markdown="Gammal",
                slug="old-one",
                source_revision=0,
                profile_fingerprint=sv_fingerprint,
                review_status="unreviewed",
            ),
            HikeTranslation(
                hike_id=hikes[2].id,
                locale_code="sv",
                title="Needs translation",
                summary_markdown="Needs translation",
                slug="needs-translation",
                source_revision=1,
                profile_fingerprint=sv_fingerprint,
                review_status="needs_retranslation",
            ),
            HikeTranslation(
                hike_id=hikes[2].id,
                locale_code="cs",
                title="Aktualni",
                summary_markdown="Aktualni",
                slug="aktualni",
                source_revision=1,
                profile_fingerprint=cs_fingerprint,
                review_status="approved",
            ),
        ]
    )
    db.flush()
    queued, _ = queue_outdated_translations(db)
    db.flush()
    jobs = db.scalars(select(TranslationJob).order_by(TranslationJob.created_at)).all()
    assert queued == 1
    assert len(jobs) == 1
    assert jobs[0].entity_id == hikes[2].id
    assert jobs[0].target_locale == "sv"
    assert jobs[0].reason == "needs_retranslation"
    # Repeat in the same transaction and again after commit, as separate CLI calls do.
    assert queue_outdated_translations(db) == (0, 1)
    db.commit()
    assert queue_outdated_translations(db) == (0, 1)
    jobs[0].status = "running"
    db.commit()
    assert queue_outdated_translations(db) == (0, 1)
    db.close()


def test_translation_worker_publishes_localized_copy_and_history(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import worker

    response = client.post("/api/hikes", json=_planned_payload())
    hike_id = UUID(response.json()["id"])
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)

    def translate(**kwargs: object) -> TranslationResult:
        assert kwargs["reasoning_effort"] == "medium"
        return TranslationResult(
            fields={
                "title": "Vandring genom högländerna",
                "tagline": "Några dagar utomhus",
                "summary_markdown": "En kort sammanfattning.",
                "description_markdown": "## Planen\n\nFölj leden.",
            },
            model="gpt-6-luna",
            input_tokens=100,
            output_tokens=40,
        )

    assert worker.run_once(translate)
    db = factory()
    try:
        swedish = db.scalar(
            select(HikeTranslation).where(
                HikeTranslation.hike_id == hike_id,
                HikeTranslation.locale_code == "sv",
            )
        )
        assert swedish is not None
        assert swedish.title == "Vandring genom högländerna"
        assert swedish.slug == "vandring-genom-hoglanderna"
        assert len(swedish.versions) == 1
        job = db.scalar(
            select(TranslationJob).where(
                TranslationJob.entity_id == hike_id,
                TranslationJob.target_locale == "sv",
            )
        )
        assert job is not None
        assert job.status == "succeeded"
    finally:
        db.close()


def test_worker_replaces_stale_job_once(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import worker

    client.post("/api/hikes", json=_planned_payload())
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    with factory.begin() as db:
        job = db.scalars(select(TranslationJob).order_by(TranslationJob.created_at)).first()
        assert job is not None
        job_id = job.id
        locale = job.target_locale
        job.profile_fingerprint = "old-worker-fingerprint"

    def unexpected_translate(**_: object) -> TranslationResult:
        pytest.fail("A stale job must be replaced before calling the provider")

    assert worker.run_once(unexpected_translate)
    with factory() as db:
        original = db.get(TranslationJob, job_id)
        assert original is not None
        assert original.status == "superseded"
        active = db.scalars(
            select(TranslationJob).where(
                TranslationJob.target_locale == locale,
                TranslationJob.status.in_(("queued", "running")),
            )
        ).all()
        assert len(active) == 1
        assert active[0].profile_fingerprint == profile_fingerprint(db, "hike", locale)[1]


def test_worker_sends_profile_model_and_effort_in_http_request(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import openai_provider, worker

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    with factory.begin() as db:
        for profile in db.scalars(select(TranslationProfile)).all():
            profile.model = "gpt-6.1-terra"
            profile.reasoning_effort = "medium"
    client.post("/api/hikes", json=_planned_payload())
    requests: list[dict[str, object]] = []

    def capture_request(request: Request, timeout: int) -> BytesIO:
        assert timeout == settings.openai_request_timeout_seconds
        assert request.full_url == "https://api.openai.com/v1/responses"
        assert request.method == "POST"
        assert isinstance(request.data, bytes)
        payload = json.loads(request.data)
        requests.append(payload)
        assert payload["model"] == "gpt-6.1-terra"
        assert payload["reasoning"] == {"effort": "medium"}
        return BytesIO(
            json.dumps(
                {
                    "model": "gpt-6.1-terra",
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": json.dumps(
                                        {
                                            "title": "Translated title",
                                            "tagline": None,
                                            "summary_markdown": "Translated summary",
                                            "description_markdown": None,
                                        }
                                    ),
                                }
                            ],
                        }
                    ],
                }
            ).encode()
        )

    monkeypatch.setattr(openai_provider, "urlopen", capture_request)
    # Exercise the actual default provider, rather than injecting a fake translator.
    assert worker.run_once()
    assert len(requests) == 1
    with factory() as db:
        assert (
            db.scalar(select(TranslationJob.status).where(TranslationJob.status == "succeeded"))
            == "succeeded"
        )


def test_slug_generation_keeps_non_latin_letters() -> None:
    from knut_vandrar_backend.translations.core import make_slug

    assert make_slug("Český výlet — Берг") == "cesky-vylet-берг"
    assert make_slug("山歩きの旅") == "山歩きの旅"


def _db_session(client: TestClient) -> Session:
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    return factory()


def _get_jobs(client: TestClient) -> list[dict[str, object]]:
    db = _db_session(client)
    jobs = db.scalars(select(TranslationJob)).all()
    result: list[dict[str, object]] = [{"target_locale": job.target_locale} for job in jobs]
    db.close()
    return result
