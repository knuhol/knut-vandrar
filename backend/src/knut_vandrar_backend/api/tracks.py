"""Paginated collection choices for the hike editor."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import false, func, or_, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.auth import require_admin_auth
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.track import TrackCollection

router = APIRouter(
    prefix="/api/track-collections", tags=["tracks"], dependencies=[Depends(require_admin_auth)]
)


class TrackCollectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    source_id: str
    direction: str | None
    location_id: UUID | None
    hike_id: UUID | None


@router.get("", response_model=Page[TrackCollectionRead], openapi_extra={"x-admin-only": True})
def list_collections(
    db: Annotated[Session, Depends(get_db)],
    location_id: UUID | None = None,
    hike_id: UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[TrackCollectionRead]:
    query = select(TrackCollection).where(
        or_(
            TrackCollection.location_id == location_id if location_id else false(),
            TrackCollection.hike_id == hike_id if hike_id else false(),
        )
    )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    return Page(
        items=[
            TrackCollectionRead.model_validate(row)
            for row in db.scalars(
                query.order_by(TrackCollection.name, TrackCollection.id).limit(limit).offset(offset)
            )
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
