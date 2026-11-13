"""Authenticated queue triggers; translation work stays in the durable worker."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.auth import require_admin_auth
from knut_vandrar_backend.api.schemas.pagination import Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.translations.queue import queue_outdated_translations
from knut_vandrar_backend.translations.selection import translation_candidates

router = APIRouter(prefix="/api/translations", tags=["translations"])


class RequeueWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    include_outdated: bool = False
    entity_type: Literal["hike", "location", "region", "achievement", "photo"] | None = None
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


class CandidateSelection(RequeueWrite):
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class TranslationCandidateRead(BaseModel):
    entity_type: Literal["hike", "location", "region", "achievement", "photo"]
    entity_id: UUID
    title: str
    locale: Literal["sv", "cs"]
    review_status: str | None
    is_missing: bool
    is_outdated: bool
    already_queued: bool


@router.get(
    "/candidates",
    response_model=Page[TranslationCandidateRead],
    dependencies=[Depends(require_admin_auth)],
    openapi_extra={"x-admin-only": True},
)
def list_translation_candidates(
    db: Annotated[Session, Depends(get_db)],
    selection: Annotated[CandidateSelection, Query()],
) -> Page[TranslationCandidateRead]:
    """Preview the selected explicit-request scope without changing any state."""
    candidates = translation_candidates(db, **selection.model_dump(exclude={"limit", "offset"}))
    total = db.scalar(select(func.count()).select_from(candidates)) or 0
    query = (
        select(candidates)
        .order_by(candidates.c.entity_type, candidates.c.entity_id, candidates.c.locale)
        .limit(selection.limit)
        .offset(selection.offset)
    )
    return Page(
        items=[
            TranslationCandidateRead.model_validate(row) for row in db.execute(query).mappings()
        ],
        total=total,
        limit=selection.limit,
        offset=selection.offset,
    )
