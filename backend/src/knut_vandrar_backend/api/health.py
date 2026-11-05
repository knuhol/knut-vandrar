"""Application and database health endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from knut_vandrar_backend.database.dependencies import get_db

router = APIRouter(tags=["health"])
DatabaseSession = Annotated[Session, Depends(get_db)]


class HealthUnavailable(BaseModel):
    """Error response when the database cannot be reached."""

    detail: str


@router.get("/")
def root() -> dict[str, str]:
    """Return a small API welcome payload."""
    return {"message": "Knut vandrar API", "health": "/health"}


@router.get(
    "/health",
    responses={503: {"model": HealthUnavailable, "description": "Database unavailable"}},
)
@router.get(
    "/api/health",
    responses={503: {"model": HealthUnavailable, "description": "Database unavailable"}},
)
def health(db: DatabaseSession) -> dict[str, str]:
    """Report healthy only when the API can reach its database."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "healthy", "database": "connected"}
