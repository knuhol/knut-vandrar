"""Authenticated queue triggers; translation work stays in the durable worker."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.translations.queue import queue_outdated_translations

router = APIRouter(prefix="/api/translations", tags=["translations"])


class RequeueRead(BaseModel):
    queued: int
    skipped: int


@router.post("/requeue", response_model=RequeueRead)
def requeue_translations(db: Annotated[Session, Depends(get_db)]) -> RequeueRead:
    """Queue only needs_retranslation entries; skip active duplicate jobs.

    Manual translations are never selected. This endpoint does not call the
    translation provider and does not automatically retranslate outdated content.
    """
    queued, skipped = queue_outdated_translations(db)
    db.commit()
    return RequeueRead(queued=queued, skipped=skipped)
