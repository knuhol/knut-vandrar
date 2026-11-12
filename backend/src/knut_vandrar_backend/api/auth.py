"""Fail-closed authentication for every non-read API operation."""

from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from knut_vandrar_backend.settings import settings

READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
bearer = HTTPBearer(auto_error=False, scheme_name="AdminBearer")


def require_write_auth(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> None:
    if request.method in READ_METHODS:
        return
    token = settings.api_write_token
    if token is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "API write access is not configured",
        )
    if credentials is None or not compare_digest(
        credentials.credentials.encode("utf-8"), token.get_secret_value().encode("utf-8")
    ):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Valid Bearer authentication is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
