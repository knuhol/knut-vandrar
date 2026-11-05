"""API tests using an isolated SQLite database."""

from collections.abc import Generator, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.location import Location  # noqa: F401 - register model metadata


@pytest.fixture()
def client(tmp_path: Path) -> Iterator[TestClient]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker[Session](bind=engine, autoflush=False)

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


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "connected"}


def test_api_health_alias(client: TestClient) -> None:
    assert client.get("/api/health").status_code == 200


def test_location_create_and_list(client: TestClient) -> None:
    created = client.post(
        "/api/locations",
        json={"name": "Lofoten", "latitude": 68.15, "longitude": 13.6333},
    )
    assert created.status_code == 201
    location = created.json()
    assert location["name"] == "Lofoten"
    assert location["visited"] is False

    listed = client.get("/api/locations")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == location["id"]


def test_location_not_found(client: TestClient) -> None:
    response = client.get("/api/locations/9999")
    assert response.status_code == 404


def test_invalid_location(client: TestClient) -> None:
    response = client.post("/api/locations", json={"latitude": "not a number"})
    assert response.status_code == 422
