"""Content notifications follow transaction outcomes and never undo committed data."""

from collections.abc import Generator
from dataclasses import replace
from unittest.mock import MagicMock
from urllib.error import URLError

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from knut_vandrar_backend import cache_invalidation
from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.models.enums import TrailType
from knut_vandrar_backend.models.trail import Trail
from knut_vandrar_backend.settings import settings as validated_settings


@pytest.fixture()
def session(monkeypatch: pytest.MonkeyPatch) -> Generator[Session, None, None]:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    monkeypatch.setattr(
        cache_invalidation,
        "settings",
        replace(
            validated_settings,
            frontend_revalidation_url="http://frontend/api/revalidate",
            cache_revalidation_secret="test-secret",
        ),
    )
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_committed_content_notifies_frontend(
    session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    notify = MagicMock()
    monkeypatch.setattr(cache_invalidation, "urlopen", notify)
    session.add(Trail(name="Test trail", type=TrailType.LOWLANDS))
    session.commit()
    notify.assert_called_once()
    request = notify.call_args.args[0]
    assert request.full_url == "http://frontend/api/revalidate"
    assert request.get_header("Authorization") == "Bearer test-secret"
    session.close()


def test_rollback_does_not_notify(session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    notify = MagicMock()
    monkeypatch.setattr(cache_invalidation, "urlopen", notify)
    session.add(Trail(name="Rolled back", type=TrailType.LOWLANDS))
    session.flush()
    session.rollback()
    session.commit()
    notify.assert_not_called()
    session.close()


def test_notification_failure_preserves_commit(
    session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cache_invalidation, "urlopen", MagicMock(side_effect=URLError("offline")))
    session.add(Trail(name="Kept trail", type=TrailType.LOWLANDS))
    session.commit()
    assert session.scalar(select(Trail.name)) == "Kept trail"
    session.close()
