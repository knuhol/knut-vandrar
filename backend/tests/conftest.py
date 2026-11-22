"""Isolated API database and media storage; never uses a running service."""

from collections.abc import Generator, Iterator
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api import auth
from knut_vandrar_backend.api.schemas.hike import (
    GpxCollectionCard,
    LivePositionCard,
    RouteCard,
    YouTubeVideoCard,
)
from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.reference import InfoCardType, Language
from knut_vandrar_backend.models.translation import TranslationProfile
from knut_vandrar_backend.settings import settings
from tests.helpers import TEST_WRITE_TOKEN


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(
        auth, "settings", replace(settings, api_write_token=SecretStr(TEST_WRITE_TOKEN))
    )
    from knut_vandrar_backend.api import photos

    monkeypatch.setattr(photos, "settings", replace(settings, media_root=tmp_path / "media"))
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker[Session](bind=engine, autoflush=False)
    app.state.testing_session_local = testing_session_local
    with testing_session_local.begin() as db:
        for locale in ("sv", "cs"):
            db.add(
                TranslationProfile(
                    content_type="photo",
                    target_locale=locale,
                    instructions="Translate photos",
                    model="gpt-6-luna",
                )
            )
        db.add_all(
            [
                Language(code="en", name="English", enabled=True, is_source=True),
                Language(code="sv", name="Swedish", enabled=True, is_source=False),
                Language(code="cs", name="Czech", enabled=True, is_source=False),
                InfoCardType(
                    type="route",
                    sort_order_active=1,
                    sort_order_finished=1,
                    data_structure=RouteCard.model_json_schema(),
                ),
                InfoCardType(
                    type="youtube_video",
                    sort_order_active=2,
                    sort_order_finished=2,
                    data_structure=YouTubeVideoCard.model_json_schema(),
                ),
                InfoCardType(
                    type="live_position",
                    sort_order_active=3,
                    sort_order_finished=3,
                    data_structure=LivePositionCard.model_json_schema(),
                ),
                InfoCardType(
                    type="gpx_collection",
                    sort_order_active=7,
                    sort_order_finished=7,
                    data_structure=GpxCollectionCard.model_json_schema(),
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

    with testing_session_local.begin() as db:
        for kind in ("location", "region", "achievement"):
            for locale in ("sv", "cs"):
                db.add(
                    TranslationProfile(
                        content_type=kind,
                        target_locale=locale,
                        instructions="Translate naturally.",
                        model="gpt-6-luna",
                    )
                )

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            test_client.headers["Authorization"] = f"Bearer {TEST_WRITE_TOKEN}"
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
        del app.state.testing_session_local
        engine.dispose()
