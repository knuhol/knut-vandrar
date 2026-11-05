"""FastAPI application and starter health endpoints."""

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.api.routes import router as locations_router
from src.database.db_session import get_db
from src.settings import settings

app = FastAPI(title="Knut vandrar API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(locations_router)


class HealthUnavailable(BaseModel):
    detail: str


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"message": "Knut vandrar API", "health": "/health"}


@app.get(
    "/health",
    tags=["health"],
    responses={503: {"model": HealthUnavailable, "description": "Database unavailable"}},
)
@app.get(
    "/api/health",
    tags=["health"],
    responses={503: {"model": HealthUnavailable, "description": "Database unavailable"}},
)
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Report healthy only when the API can reach its database."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "healthy", "database": "connected"}
