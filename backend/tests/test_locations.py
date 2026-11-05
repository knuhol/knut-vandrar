"""API tests using an isolated SQLite database."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.database.db_session import Base, get_db
from src.main import app
from src.models.location import Location  # noqa: F401 - register model metadata


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSessionLocal()
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


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "connected"}


def test_api_health_alias(client):
    assert client.get("/api/health").status_code == 200


def test_location_create_and_list(client):
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


def test_location_not_found(client):
    response = client.get("/api/locations/9999")
    assert response.status_code == 404


def test_invalid_location(client):
    response = client.post("/api/locations", json={"latitude": "not a number"})
    assert response.status_code == 422
