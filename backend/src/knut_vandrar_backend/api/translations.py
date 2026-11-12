"""Authenticated queue triggers; translation work stays in the durable worker."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, model_validator
from sqlalchemy.orm import Session

from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.translations.queue import queue_outdated_translations

router = APIRouter(prefix="/api/translations", tags=["translations"])


class RequeueWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    include_outdated: bool = False
    entity_type: Literal["hike", "location", "region", "achievement"] | None = None
    entity_id: UUID | None = None
    locale: Literal["sv", "cs"] | None = None

    @model_validator(mode="after")
    def validate_selection(self) -> "RequeueWrite":
        if self.entity_id is not None and self.entity_type is None:
            raise ValueError("entity_id requires entity_type")
        return self


class RequeueRead(BaseModel):
    queued: int
    skipped: int


@router.post("/requeue", response_model=RequeueRead)
def requeue_translations(
    db: Annotated[Session, Depends(get_db)], payload: RequeueWrite | None = None
) -> RequeueRead:
    """Explicitly request flagged translations, or opt in to missing/outdated text.

    Optional entity and locale filters restrict the request. Manual overrides are
    always protected. The worker processes the jobs; this endpoint never calls AI.
    """
    selection = payload or RequeueWrite()
    queued, skipped = queue_outdated_translations(db, **selection.model_dump())
    db.commit()
    return RequeueRead(queued=queued, skipped=skipped)
