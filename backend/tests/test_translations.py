"""Explicit translation requests, worker races, history, and cost limits."""

import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import cast
from urllib.request import Request
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api import auth
from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.models.translation import TranslationJob, TranslationProfile
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.translations.cli import queue_outdated_translations
from knut_vandrar_backend.translations.core import profile_fingerprint
from knut_vandrar_backend.translations.openai_provider import TranslationResult
from tests.helpers import (
    _db_session,
    _get_jobs,
    _planned_payload,
    _png_image,
    _request_translations,
)


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
    _request_translations(client, "hike", response.json()["id"])
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


def test_worker_discards_stale_job_without_replacement(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import worker

    hike = client.post("/api/hikes", json=_planned_payload()).json()
    _request_translations(client, "hike", hike["id"])
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
        assert len(active) == 0


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
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    _request_translations(client, "hike", hike["id"])
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


@pytest.mark.parametrize(
    "kind,path,english",
    [
        (
            "location",
            "/api/locations",
            {"name": "Original", "season_note": None, "overnight_restrictions_note": None},
        ),
        ("region", "/api/regions", {"name": "Original"}),
        ("achievement", "/api/achievements", {"title": "Original", "description": None}),
    ],
    ids=["location", "region", "achievement"],
)
def test_authored_manual_translation_survives_inflight_result(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    kind: str,
    path: str,
    english: dict[str, str | None],
) -> None:
    from knut_vandrar_backend.translations import content_worker, worker
    from knut_vandrar_backend.translations.content import translation_for

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    monkeypatch.setattr(content_worker, "SessionLocal", factory)
    payload: dict[str, object] = {"english": english}
    if kind == "location":
        payload["country_codes"] = ["SE"]
    if kind == "achievement":
        hike = client.post("/api/hikes", json=_planned_payload()).json()
        payload.update(hike_id=hike["id"], icon="trophy")
        with factory.begin() as db:
            for job in db.scalars(select(TranslationJob)):
                job.status = "superseded"
    created = client.post(path, json=payload)
    assert created.status_code == 201, created.text
    entity_id = created.json()["id"]
    _request_translations(client, kind, entity_id)
    manual = {
        key: ("Manual text" if key in ("name", "title") else value)
        for key, value in english.items()
    }

    def translate(**arguments: object) -> TranslationResult:
        locale = str(arguments["target_locale"])
        result = client.put(f"{path}/{entity_id}/translations/{locale}", json=manual)
        assert result.status_code == 200, result.text
        return TranslationResult(fields=english, model="test", input_tokens=1, output_tokens=1)

    assert worker.run_once(translate)
    with factory() as db:
        target = translation_for(db, kind, UUID(entity_id), "sv")
        assert target is not None
        assert target.review_status == "manual"
        assert getattr(target, "name", getattr(target, "title", None)) == "Manual text"
    changed = {**english, "name" if "name" in english else "title": "New English"}
    assert (
        client.put(f"{path}/{entity_id}", json={**payload, "english": changed}).status_code == 200
    )
    result = client.get(f"{path}/{entity_id}?locale=sv").json()
    assert result["translation"]["review_status"] == "manual"
    assert result["translation"]["is_outdated"] is True
    assert (
        client.put(
            f"{path}/{entity_id}/translations/sv/review",
            json={"review_status": "needs_retranslation"},
        ).status_code
        == 200
    )


def test_region_automatic_translation_publishes_history(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.models.location import RegionTranslation
    from knut_vandrar_backend.models.translation import ContentTranslationVersion
    from knut_vandrar_backend.translations import content_worker, worker

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    monkeypatch.setattr(content_worker, "SessionLocal", factory)
    region = client.post("/api/regions", json={"english": {"name": "Lapland"}}).json()

    _request_translations(client, "region", region["id"])

    def translate(**arguments: object) -> TranslationResult:
        assert arguments["source_fields"] == {"name": "Lapland"}
        return TranslationResult(
            fields={"name": "Lappland"}, model="test", input_tokens=1, output_tokens=1
        )

    assert worker.run_once(translate)
    with factory() as db:
        target = db.get(RegionTranslation, (UUID(region["id"]), "sv"))
        assert target is not None and target.name == "Lappland"
        assert target.review_status == "unreviewed"
        snapshot = db.scalar(select(ContentTranslationVersion))
        assert snapshot is not None and snapshot.fields == {"name": "Lappland"}


def test_translation_requeue_api_is_idempotent_and_preserves_manual(client: TestClient) -> None:
    from knut_vandrar_backend.models.location import RegionTranslation

    hike = client.post("/api/hikes", json=_planned_payload()).json()
    region = client.post("/api/regions", json={"english": {"name": "Lapland"}}).json()
    with _db_session(client) as db:
        for job in db.scalars(select(TranslationJob)):
            job.status = "superseded"
        for locale, review in [("sv", "needs_retranslation"), ("cs", "manual")]:
            db.add(
                HikeTranslation(
                    hike_id=UUID(hike["id"]),
                    locale_code=locale,
                    title="Text",
                    summary_markdown="Text",
                    slug=f"text-{locale}",
                    review_status=review,
                )
            )
            db.add(
                RegionTranslation(
                    region_id=UUID(region["id"]),
                    locale_code=locale,
                    name="Text",
                    review_status=review,
                )
            )
        db.commit()
    first = client.post("/api/translations/requeue")
    assert first.status_code == 200, first.text
    assert first.json() == {"queued": 2, "skipped": 0}
    assert client.post("/api/translations/requeue").json() == {"queued": 0, "skipped": 2}
    with _db_session(client) as db:
        manual = db.get(RegionTranslation, (UUID(region["id"]), "cs"))
        assert manual is not None and manual.review_status == "manual"
        active = db.scalars(select(TranslationJob).where(TranslationJob.status == "queued")).all()
        assert len(active) == 2
        assert all(job.target_locale == "sv" for job in active)


@pytest.mark.parametrize(
    "kind,path,english",
    [
        (
            "location",
            "/api/locations",
            {"name": "Original", "season_note": None, "overnight_restrictions_note": None},
        ),
        ("region", "/api/regions", {"name": "Original"}),
        ("achievement", "/api/achievements", {"title": "Original", "description": None}),
    ],
    ids=["location", "region", "achievement"],
)
def test_source_edits_and_review_changes_never_queue(
    client: TestClient, kind: str, path: str, english: dict[str, str | None]
) -> None:
    payload: dict[str, object] = {"english": english}
    if kind == "location":
        payload["country_codes"] = ["SE"]
    if kind == "achievement":
        payload.update(
            hike_id=client.post("/api/hikes", json=_planned_payload()).json()["id"], icon="trophy"
        )
    created = client.post(path, json=payload)
    assert created.status_code == 201, created.text
    entity_id = created.json()["id"]
    assert _get_jobs(client) == []
    assert client.put(f"{path}/{entity_id}/translations/sv", json=english).status_code == 200
    changed = {**english, "name" if "name" in english else "title": "Changed source"}
    assert (
        client.put(f"{path}/{entity_id}", json={**payload, "english": changed}).status_code == 200
    )
    assert client.get(f"{path}/{entity_id}?locale=sv").json()["translation"]["is_outdated"] is True
    assert _get_jobs(client) == []
    assert (
        client.put(
            f"{path}/{entity_id}/translations/sv/review",
            json={"review_status": "needs_retranslation"},
        ).status_code
        == 200
    )
    assert _get_jobs(client) == []
    _request_translations(client, kind, entity_id)


def test_hike_edits_only_mark_outdated_and_explicit_selection_queues(client: TestClient) -> None:
    payload = _planned_payload()
    hike = client.post("/api/hikes", json=payload).json()
    manual = {
        "title": "Swedish",
        "summary_markdown": "Summary",
        "tagline": None,
        "description_markdown": None,
    }
    assert client.put(f"/api/hikes/{hike['id']}/translations/sv", json=manual).status_code == 200
    changed = _planned_payload(
        english={"title": "Edited title", "summary_markdown": "Edited summary"}
    )
    assert client.put(f"/api/hikes/{hike['id']}", json=changed).status_code == 200
    assert _get_jobs(client) == []
    assert (
        client.get(f"/api/hikes/{hike['id']}?locale=sv").json()["translation"]["is_outdated"]
        is True
    )
    # Even an explicit broader request cannot replace manual content.
    response = client.post(
        "/api/translations/requeue",
        json={
            "include_outdated": True,
            "entity_type": "hike",
            "entity_id": hike["id"],
            "locale": "sv",
        },
    )
    assert response.json() == {"queued": 0, "skipped": 0}
    assert (
        client.put(
            f"/api/hikes/{hike['id']}/translations/sv/review",
            json={"review_status": "needs_retranslation"},
        ).status_code
        == 200
    )
    assert _get_jobs(client) == []
    _request_translations(client, "hike", hike["id"])


@pytest.mark.parametrize("kind", ["hike", "region"])
@pytest.mark.parametrize(
    "during_request",
    [False, True],
    ids=["source-changed-before-request", "source-changed-during-request"],
)
def test_stale_jobs_do_not_create_replacement_or_publish(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, kind: str, during_request: bool
) -> None:
    from knut_vandrar_backend.translations import content_worker, worker

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    monkeypatch.setattr(content_worker, "SessionLocal", factory)
    path = "/api/hikes" if kind == "hike" else "/api/regions"
    payload = _planned_payload() if kind == "hike" else {"english": {"name": "Original"}}
    entity_id = client.post(path, json=payload).json()["id"]
    _request_translations(client, kind, entity_id)
    update = (
        _planned_payload(english={"title": "New English", "summary_markdown": "New English"})
        if kind == "hike"
        else {"english": {"name": "New English"}}
    )
    if not during_request:
        assert client.put(f"{path}/{entity_id}", json=update).status_code == 200

    def translate(**arguments: object) -> TranslationResult:
        if not during_request:
            pytest.fail("Already-obsolete jobs must not call the provider")
        assert client.put(f"{path}/{entity_id}", json=update).status_code == 200
        return TranslationResult(
            fields=cast(dict[str, str | None], arguments["source_fields"]),
            model="test",
            input_tokens=1,
            output_tokens=1,
        )

    assert worker.run_once(translate)
    assert not worker.run_once(translate)
    with factory() as db:
        jobs = db.scalars(select(TranslationJob)).all()
        assert len(jobs) == 1 and jobs[0].status == "superseded"
    _request_translations(client, kind, entity_id)


def test_worker_refuses_legacy_automatic_jobs(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import worker

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    with factory.begin() as db:
        for reason in ["source_changed", "superseded", "initial_migration"]:
            db.add(
                TranslationJob(
                    entity_type="hike",
                    entity_id=UUID(hike["id"]),
                    target_locale="sv",
                    source_revision=1,
                    profile_fingerprint="old",
                    reason=reason,
                    status="queued",
                )
            )

    def unexpected(**_: object) -> TranslationResult:
        pytest.fail("Legacy automatic work must not call the provider")

    for _ in range(3):
        assert worker.run_once(unexpected)
    with factory() as db:
        assert all(job.status == "superseded" for job in db.scalars(select(TranslationJob)))


def test_requeue_defaults_to_flagged_and_validates_selection(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    assert client.post("/api/translations/requeue").json() == {"queued": 0, "skipped": 0}
    for body in [{"entity_id": hike["id"]}, {"locale": "en"}, {"entity_type": "wrong"}]:
        assert client.post("/api/translations/requeue", json=body).status_code == 422
    assert _get_jobs(client) == []


def test_worker_recovery_cannot_reset_cost_limit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import worker

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    old = datetime.now(UTC) - timedelta(days=1)
    with factory.begin() as db:
        for reason, attempts in [
            ("explicit_request", 5),
            ("explicit_request", 2),
            ("source_changed", 1),
        ]:
            db.add(
                TranslationJob(
                    entity_type="hike",
                    entity_id=UUID(hike["id"]),
                    target_locale="sv",
                    source_revision=1,
                    profile_fingerprint="old",
                    reason=reason,
                    status="running",
                    attempts=attempts,
                    updated_at=old,
                )
            )
    worker._recover_abandoned_jobs()
    with factory() as db:
        jobs = db.scalars(select(TranslationJob)).all()
        assert {(job.reason, job.attempts, job.status) for job in jobs} == {
            ("explicit_request", 5, "failed"),
            ("explicit_request", 2, "queued"),
            ("source_changed", 1, "superseded"),
        }


def test_translation_candidates_preview_matches_request_and_has_no_side_effects(
    client: TestClient,
) -> None:
    from knut_vandrar_backend.models.location import RegionTranslation

    hike = client.post("/api/hikes", json=_planned_payload()).json()
    region = client.post("/api/regions", json={"english": {"name": "Lapland"}}).json()
    with _db_session(client) as db:
        db.add(
            RegionTranslation(
                region_id=UUID(region["id"]),
                locale_code="sv",
                name="Text",
                review_status="needs_retranslation",
            )
        )
        db.add(
            RegionTranslation(
                region_id=UUID(region["id"]),
                locale_code="cs",
                name="Manual",
                review_status="manual",
            )
        )
        db.commit()
    flagged = client.get("/api/translations/candidates")
    assert flagged.status_code == 200, flagged.text
    assert flagged.json()["total"] == 1
    assert flagged.json()["items"][0]["title"] == "Lapland"
    assert flagged.json()["items"][0]["review_status"] == "needs_retranslation"
    assert not flagged.json()["items"][0]["already_queued"]
    broad = {"include_outdated": True}
    page = client.get(
        "/api/translations/candidates", params={"include_outdated": "true", "limit": 1}
    ).json()
    assert page["total"] == 3
    assert len(page["items"]) == 1
    next_page = client.get(
        "/api/translations/candidates", params={"include_outdated": "true", "limit": 1, "offset": 1}
    ).json()
    assert next_page["items"] != page["items"]
    assert (
        client.get(
            "/api/translations/candidates",
            params={
                "entity_type": "hike",
                "entity_id": hike["id"],
                "locale": "cs",
                "include_outdated": "true",
            },
        ).json()["total"]
        == 1
    )
    with _db_session(client) as db:
        assert list(db.scalars(select(TranslationJob))) == []
    result = client.post("/api/translations/requeue", json=broad).json()
    assert result == {"queued": 3, "skipped": 0}
    rows = client.get("/api/translations/candidates", params={"include_outdated": "true"}).json()
    assert rows["total"] == 3
    assert all(row["already_queued"] for row in rows["items"])
    assert sum(row["is_missing"] for row in rows["items"]) == 2
    assert client.post("/api/translations/requeue", json=broad).json() == {
        "queued": 0,
        "skipped": 3,
    }


def test_translation_candidates_auth_and_validation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    invalid: list[dict[str, str | int]] = [
        {"entity_id": "00000000-0000-0000-0000-000000000001"},
        {"locale": "en"},
        {"limit": 101},
        {"offset": -1},
    ]
    for params in invalid:
        assert client.get("/api/translations/candidates", params=params).status_code == 422
    client.headers.pop("Authorization", None)
    response = client.get("/api/translations/candidates")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert (
        client.get(
            "/api/translations/candidates", headers={"Authorization": "Bearer wrong"}
        ).status_code
        == 401
    )
    monkeypatch.setattr(auth, "settings", replace(settings, api_write_token=None))
    assert client.get("/api/translations/candidates").status_code == 503


def test_translation_candidates_current_and_profile_outdated(client: TestClient) -> None:
    from knut_vandrar_backend.models.location import RegionTranslation

    region = client.post("/api/regions", json={"english": {"name": "Region"}}).json()
    with _db_session(client) as db:
        db.add(
            RegionTranslation(
                region_id=UUID(region["id"]),
                locale_code="sv",
                name="Region",
                review_status="approved",
                source_revision=1,
                profile_fingerprint=profile_fingerprint(db, "region", "sv")[1],
            )
        )
        db.commit()
    selection = {"entity_type": "region", "locale": "sv", "include_outdated": "true"}
    assert client.get("/api/translations/candidates", params=selection).json()["total"] == 0
    with _db_session(client) as db:
        target = db.get(RegionTranslation, (UUID(region["id"]), "sv"))
        assert target is not None
        target.profile_fingerprint = None
        db.commit()
    rows = client.get("/api/translations/candidates", params=selection).json()
    assert rows["total"] == 1
    assert rows["items"][0]["is_outdated"]
    assert not rows["items"][0]["is_missing"]
    assert (
        client.get(
            "/api/translations/candidates", params={"entity_type": "region", "locale": "sv"}
        ).json()["total"]
        == 0
    )


def test_gallery_metadata_translation_is_explicit(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    photo = client.post(f"/api/hikes/{hike['id']}/photos", content=_png_image((32, 64))).json()
    path = f"/api/photos/{photo['id']}"
    assert (
        client.put(path, json={"english": {"alt": "A lake", "caption": "At dusk"}}).status_code
        == 200
    )
    assert client.get(path + "?locale=sv").json()["caption"] == "At dusk"
    with app.state.testing_session_local() as db:
        assert not db.scalars(select(TranslationJob)).all()
    assert (
        client.put(
            path + "/translations/sv", json={"alt": "En sjö", "caption": "I skymningen"}
        ).status_code
        == 200
    )
    assert client.get(path + "?locale=sv").json()["caption"] == "I skymningen"
    queued = client.post(
        "/api/translations/requeue",
        json={"include_outdated": True, "entity_type": "photo", "entity_id": photo["id"]},
    )
    assert queued.status_code == 200, queued.text
    assert queued.json()["queued"] == 1  # Swedish manual text is protected.
    assert client.get(path + "?locale=cs").json()["translation"]["locale"] == "en"


def test_photo_worker_uses_existing_translation_pipeline(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from typing import Any

    from knut_vandrar_backend.translations import content_worker

    monkeypatch.setattr(content_worker, "SessionLocal", app.state.testing_session_local)
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    photo = client.post(f"/api/hikes/{hike['id']}/photos", content=_png_image((20, 20))).json()
    path = f"/api/photos/{photo['id']}"
    client.put(path, json={"english": {"alt": "Forest", "caption": None}})
    client.post(
        "/api/translations/requeue",
        json={
            "entity_type": "photo",
            "entity_id": photo["id"],
            "include_outdated": True,
            "locale": "sv",
        },
    )
    with app.state.testing_session_local() as db:
        job_id = db.scalar(select(TranslationJob.id).where(TranslationJob.entity_type == "photo"))

    def translate(**kwargs: Any) -> TranslationResult:
        assert kwargs["source_fields"] == {"alt": "Forest", "caption": None}
        return TranslationResult(
            fields={"alt": "Skog", "caption": None}, model="test", input_tokens=1, output_tokens=1
        )

    content_worker.process_content(job_id, translate)
    result = client.get(path + "?locale=sv").json()
    assert result["alt"] == "Skog" and result["caption"] is None
    assert result["translation"]["locale"] == "sv"


def test_hike_manual_override_survives_inflight_result(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.translations import worker

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    _request_translations(client, "hike", hike["id"])
    fields = {
        "title": "Manual Swedish",
        "tagline": None,
        "summary_markdown": "Manual summary",
        "description_markdown": None,
    }

    def translate(**arguments: object) -> TranslationResult:
        locale = str(arguments["target_locale"])
        response = client.put(f"/api/hikes/{hike['id']}/translations/{locale}", json=fields)
        assert response.status_code == 200, response.text
        assert response.json()["review_status"] == "manual"
        return TranslationResult(
            fields={**fields, "title": "Automatic overwrite"},
            model="test",
            input_tokens=1,
            output_tokens=1,
        )

    assert worker.run_once(translate)
    with factory() as db:
        target = db.scalar(
            select(HikeTranslation).where(
                HikeTranslation.hike_id == UUID(hike["id"]), HikeTranslation.locale_code == "sv"
            )
        )
        assert target is not None and target.title == "Manual Swedish"
        assert target.review_status == "manual"
