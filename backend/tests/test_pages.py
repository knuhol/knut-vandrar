"""Independent page publication, template validation, and migrated content."""

from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api import auth
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.main import app
from knut_vandrar_backend.settings import settings

TOKEN = "page-tests-" + "a" * 32
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    engine = create_engine(f"sqlite:///{tmp_path / 'pages.db'}")
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        for revision in (
            "012_manual_pages",
            "013_privacy_policy",
            "014_umami_privacy_policy",
        ):
            migration = scripts.get_revision(revision)
            assert migration is not None
            migration.module.upgrade()
    sessions = sessionmaker[Session](engine)

    def db() -> Iterator[Session]:
        with sessions() as session:
            yield session

    monkeypatch.setattr(auth, "settings", replace(settings, api_write_token=SecretStr(TOKEN)))
    app.dependency_overrides[get_db] = db
    try:
        with TestClient(app) as http:
            yield http
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_migrated_content_and_no_locale_fallback(client: TestClient) -> None:
    for locale in ("en", "sv", "cs"):
        response = client.get(f"/api/pages/about?locale={locale}")
        assert response.status_code == 200
        page = response.json()
        assert page["content"]["type"] == "about"
        assert "[current_age]" in page["content"]["body_markdown"]
        assert "[years_in_sweden]" in page["content"]["body_markdown"]
        assert page["available_locales"] == ["cs", "en", "sv"]
    notes = client.get("/api/pages/czech-translation-notes?locale=cs").json()
    assert notes["content"]["title"] == "Proč píšu hike a trail"
    assert "Section hike" in notes["content"]["body_markdown"]
    for locale in ("sv", "en"):
        assert client.get(f"/api/pages/czech-translation-notes?locale={locale}").status_code == 404
    assert client.get("/api/pages/about?locale=de").status_code == 422
    assert len(client.get("/api/pages").json()) == 7


def test_admin_reads_are_private_and_publication_is_independent(client: TestClient) -> None:
    assert client.get("/api/page-locales").status_code == 401
    rows = client.get("/api/page-locales", headers=HEADERS).json()["items"]
    row = next(row for row in rows if row["page_key"] == "about" and row["locale"] == "sv")
    entity_id = row.pop("id")
    row["published"] = False
    assert client.put(f"/api/page-locales/{entity_id}", json=row).status_code == 401
    assert (
        client.put(f"/api/page-locales/{entity_id}", json=row, headers=HEADERS).status_code == 200
    )
    assert client.get(f"/api/page-locales/{entity_id}").status_code == 401
    assert client.get("/api/pages/about?locale=sv").status_code == 404
    assert client.get("/api/pages/about?locale=en").json()["available_locales"] == ["cs", "en"]
    assert len(client.get("/api/pages").json()) == 6
    row["published"] = True
    row["indexable"] = False
    assert (
        client.put(f"/api/page-locales/{entity_id}", json=row, headers=HEADERS).status_code == 200
    )
    assert client.get("/api/pages/about?locale=sv").json()["indexable"] is False


def test_manual_locale_create_update_delete_and_template_validation(client: TestClient) -> None:
    payload = {
        "page_key": "czech-translation-notes",
        "locale": "sv",
        "published": False,
        "content": {
            "type": "standard",
            "eyebrow": "Language",
            "title": "Notes",
            "introduction": "Intro",
            "body_markdown": "Body",
        },
    }
    response = client.post("/api/page-locales", json=payload, headers=HEADERS)
    assert response.status_code == 201
    entity_id = response.json()["id"]
    assert client.get("/api/pages/czech-translation-notes?locale=sv").status_code == 404
    assert client.post("/api/page-locales", json=payload, headers=HEADERS).status_code == 409
    payload["published"] = True
    assert (
        client.put(f"/api/page-locales/{entity_id}", json=payload, headers=HEADERS).status_code
        == 200
    )
    assert client.get("/api/pages/czech-translation-notes?locale=sv").json()[
        "available_locales"
    ] == ["cs", "sv"]
    payload["page_key"] = "about"
    assert (
        client.put(f"/api/page-locales/{entity_id}", json=payload, headers=HEADERS).status_code
        == 422
    )
    assert client.delete(f"/api/page-locales/{entity_id}", headers=HEADERS).status_code == 204
    assert client.get("/api/pages/czech-translation-notes?locale=sv").status_code == 404


def test_privacy_policy_is_published_editable_and_not_indexable(client: TestClient) -> None:
    for locale in ("sv", "en", "cs"):
        response = client.get(f"/api/pages/privacy-policy?locale={locale}")
        assert response.status_code == 200
        page = response.json()
        assert page["content"]["type"] == "standard"
        assert page["indexable"] is False
        assert page["available_locales"] == ["cs", "en", "sv"]
        assert "umami.vandrar.se" in page["content"]["body_markdown"]
        assert "knut-analytics-consent" not in page["content"]["body_markdown"]
        assert "Google Analytics" not in page["content"]["body_markdown"]
        assert "**Cookie settings**" not in page["content"]["body_markdown"]
        assert "**Inställningar för kakor**" not in page["content"]["body_markdown"]
        assert "**Nastavení cookies**" not in page["content"]["body_markdown"]
    rows = client.get("/api/page-locales", headers=HEADERS).json()["items"]
    row = next(row for row in rows if row["page_key"] == "privacy-policy" and row["locale"] == "en")
    entity_id = row.pop("id")
    row["content"]["title"] = "Updated privacy policy"
    assert (
        client.put(f"/api/page-locales/{entity_id}", json=row, headers=HEADERS).status_code == 200
    )
    assert (
        client.get("/api/pages/privacy-policy?locale=en").json()["content"]["title"]
        == "Updated privacy policy"
    )
