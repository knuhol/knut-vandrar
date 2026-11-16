"""Bounded URL discovery without loading stories, photos, or related trail content."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.schemas.hike import HikeDiscoveryRead, HikeSlugRead
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.hike import Hike, HikeTranslation

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


@router.get("/hikes", response_model=Page[HikeDiscoveryRead])
def discover_hikes(
    db: Annotated[Session, Depends(get_db)], limit: Limit = 100, offset: Offset = 0
) -> Page[HikeDiscoveryRead]:
    query = select(Hike.id).where(Hike.translations.any())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ids = db.scalars(query.order_by(Hike.id).limit(limit).offset(offset)).all()
    translations: dict[str, list[HikeSlugRead]] = {str(hike_id): [] for hike_id in ids}
    if ids:
        for hike_id, locale, slug in db.execute(
            select(HikeTranslation.hike_id, HikeTranslation.locale_code, HikeTranslation.slug)
            .where(HikeTranslation.hike_id.in_(ids))
            .order_by(HikeTranslation.locale_code)
        ):
            translations[str(hike_id)].append(HikeSlugRead(locale=locale, slug=slug))
    return Page(
        items=[
            HikeDiscoveryRead(id=hike_id, translations=translations[str(hike_id)])
            for hike_id in ids
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
