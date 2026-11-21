"""Write authentication, public reads, and credential redaction."""

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from knut_vandrar_backend.api import auth
from knut_vandrar_backend.main import app
from knut_vandrar_backend.settings import settings
from tests.helpers import (
    TEST_WRITE_TOKEN,
)


@pytest.mark.parametrize(
    "authorization",
    [None, "", "Basic anything", "Bearer wrong-token", "Bearer", "Bearer wrong token"],
    ids=[
        "missing-header",
        "empty-header",
        "wrong-auth-scheme",
        "incorrect-token",
        "missing-bearer-token",
        "token-with-spaces",
    ],
)
def test_write_auth_rejects_missing_or_invalid_credentials(
    client: TestClient, authorization: str | None
) -> None:
    client.headers.pop("Authorization", None)
    headers = {"Authorization": authorization} if authorization is not None else {}
    for method, path in [
        ("POST", "/api/hikes"),
        ("PUT", "/api/locations/00000000-0000-0000-0000-000000000001"),
        ("DELETE", "/api/regions/00000000-0000-0000-0000-000000000001"),
        ("POST", "/api/translations/requeue"),
    ]:
        response = client.request(method, path, headers=headers, json={})
        assert response.status_code == 401, response.text
        assert response.headers["www-authenticate"] == "Bearer"
        assert TEST_WRITE_TOKEN not in response.text


def test_reads_and_cors_preflight_are_public(client: TestClient) -> None:
    client.headers.pop("Authorization", None)
    for path in [
        "/health",
        "/api/hikes",
        "/api/locations",
        "/api/regions",
        "/api/achievements",
        "/openapi.json",
    ]:
        assert client.get(path).status_code == 200
    response = client.options(
        "/api/hikes",
        headers={
            "Origin": settings.cors_origins[0],
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == settings.cors_origins[0]
    assert client.get("/health", headers={"Authorization": "Bearer wrong"}).status_code == 200


def test_writes_fail_closed_without_configuration(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth, "settings", replace(settings, api_write_token=None))
    assert client.post("/api/translations/requeue").status_code == 503
    assert client.get("/api/hikes").status_code == 200


def test_new_write_routes_inherit_authentication(client: TestClient) -> None:
    def future_write() -> dict[str, bool]:
        return {"ok": True}

    app.add_api_route("/_test/future-write", future_write, methods=["PATCH"])
    route = app.router.routes[-1]
    try:
        assert (
            client.patch(
                "/_test/future-write", headers={"Authorization": "Bearer wrong"}
            ).status_code
            == 401
        )
        assert client.patch("/_test/future-write").json() == {"ok": True}
    finally:
        app.router.routes.remove(route)


def test_openapi_documents_write_auth_but_not_public_reads(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert schema["components"]["securitySchemes"]["AdminBearer"]["scheme"] == "bearer"
    for path in schema["paths"].values():
        for method, operation in path.items():
            if method in {"get", "head", "options"} and not operation.get("x-admin-only"):
                assert not operation.get("security")
            elif method in {"post", "put", "patch", "delete"} or operation.get("x-admin-only"):
                assert {"AdminBearer": []} in operation["security"]
                assert "401" in operation["responses"]
    assert TEST_WRITE_TOKEN not in json.dumps(schema)


def test_token_configuration_validation_and_redaction(monkeypatch: pytest.MonkeyPatch) -> None:
    from knut_vandrar_backend.settings import _write_token

    monkeypatch.delenv("API_WRITE_TOKEN", raising=False)
    assert _write_token() is None
    for value in ["", "   "]:
        monkeypatch.setenv("API_WRITE_TOKEN", value)
        assert _write_token() is None
    for value in ["short", "a" * 129, "x " * 32]:
        monkeypatch.setenv("API_WRITE_TOKEN", value)
        with pytest.raises(RuntimeError, match="API_WRITE_TOKEN"):
            _write_token()
    monkeypatch.setenv("API_WRITE_TOKEN", TEST_WRITE_TOKEN)
    token = _write_token()
    assert token is not None and token.get_secret_value() == TEST_WRITE_TOKEN
    assert TEST_WRITE_TOKEN not in repr(token)
    assert TEST_WRITE_TOKEN not in repr(replace(settings, api_write_token=token))
