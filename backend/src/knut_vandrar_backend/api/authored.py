"""Shared CRUD and manual translation endpoints for authored entities."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.schemas.location import (
    AchievementEnglish,
    AchievementRead,
    AchievementWrite,
    LocationEnglish,
    LocationRead,
    RegionEnglish,
    RegionRead,
    RegionWrite,
)
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.reference import Language
from knut_vandrar_backend.translations.content import (
    CONTENT,
    localized,
    set_source,
    snapshot,
    translation_for,
)
from knut_vandrar_backend.translations.core import profile_fingerprint

DatabaseSession = Annotated[Session, Depends(get_db)]


class ReviewWrite(BaseModel):
    review_status: TranslationReviewStatus


def read_authored(db: Session, kind: str, entity: Any, locale: str) -> dict[str, Any]:
    text, metadata = localized(db, kind, entity, locale)
    result = {key: getattr(text, key) for key in CONTENT[kind].fields}
    result.update(id=entity.id, translation=metadata)
    if kind == "photo":
        from knut_vandrar_backend.api.photos import read_photo

        return read_photo(db, entity, locale)
    if kind == "achievement":
        result.update(hike_id=entity.hike_id, icon=entity.icon, sort_order=entity.sort_order)
    return result


def authored_router(kind: str, path: str, write_schema: Any, read_schema: Any) -> APIRouter:
    spec = CONTENT[kind]
    router = APIRouter(prefix=path, tags=[kind])

    def require(db: Session, entity_id: UUID) -> Any:
        entity = db.get(spec.entity, entity_id)
        if entity is None:
            raise HTTPException(404, "Content not found")
        return entity

    def save(db: Session, entity: Any, payload: Any) -> None:
        for key, value in payload.model_dump(exclude={"english"}).items():
            setattr(entity, key, value)
        if kind == "achievement" and db.get(Hike, entity.hike_id) is None:
            raise HTTPException(422, "Hike not found")
        db.add(entity)
        db.flush()
        set_source(db, kind, entity, payload.english.model_dump())

    def create(payload: Any, db: DatabaseSession) -> Any:
        entity = spec.entity()
        save(db, entity, payload)
        db.commit()
        return read_authored(db, kind, entity, "en")

    def update(entity_id: UUID, payload: Any, db: DatabaseSession) -> Any:
        entity = require(db, entity_id)
        save(db, entity, payload)
        db.commit()
        return read_authored(db, kind, entity, "en")

    def listing(
        db: DatabaseSession,
        locale: str = "en",
        limit: Limit = 10,
        offset: Offset = 0,
        hike_id: UUID | None = None,
    ) -> Any:
        query = select(spec.entity)
        if kind == "achievement" and hike_id is not None:
            query = query.where(spec.entity.hike_id == hike_id)
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        return {
            "items": [
                read_authored(db, kind, entity, locale)
                for entity in db.scalars(query.order_by(spec.entity.id).limit(limit).offset(offset))
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get(entity_id: UUID, db: DatabaseSession, locale: str = "en") -> Any:
        return read_authored(db, kind, require(db, entity_id), locale)

    def remove(entity_id: UUID, db: DatabaseSession) -> Response:
        if kind == "region":
            from knut_vandrar_backend.models.location import LocationRegion

            if db.scalar(
                select(LocationRegion.region_id)
                .where(LocationRegion.region_id == entity_id)
                .limit(1)
            ):
                raise HTTPException(409, "Region is still associated with locations")
        db.delete(require(db, entity_id))
        db.commit()
        return Response(status_code=204)

    create.__annotations__["payload"] = write_schema
    update.__annotations__["payload"] = write_schema
    router.add_api_route(
        "",
        create,
        methods=["POST"],
        response_model=read_schema,
        status_code=201,
        name=f"create_{kind}",
    )
    router.add_api_route(
        "", listing, methods=["GET"], response_model=Page[read_schema], name=f"list_{kind}"
    )
    router.add_api_route(
        "/{entity_id}", get, methods=["GET"], response_model=read_schema, name=f"get_{kind}"
    )
    router.add_api_route(
        "/{entity_id}", update, methods=["PUT"], response_model=read_schema, name=f"update_{kind}"
    )
    router.add_api_route(
        "/{entity_id}", remove, methods=["DELETE"], status_code=204, name=f"delete_{kind}"
    )
    return router


def translation_router(kind: str, path: str) -> APIRouter:
    spec = CONTENT[kind]
    router = APIRouter(prefix=path, tags=[f"{kind} translations"])

    def require(db: Session, entity_id: UUID, locale: str) -> Any:
        entity = db.scalar(select(spec.entity).where(spec.entity.id == entity_id).with_for_update())
        language = db.get(Language, locale)
        if entity is None or language is None or not language.enabled:
            raise HTTPException(404, "Content or language not found")
        if locale == "en":
            raise HTTPException(422, "Edit English through the source endpoint")
        return entity

    def override(
        entity_id: UUID, locale: str, payload: Any, request: Request, db: DatabaseSession
    ) -> Any:
        entity = require(db, entity_id, locale)
        fields = payload.model_dump()
        target = translation_for(db, kind, entity_id, locale)
        if target is None:
            target = spec.translation(**{spec.owner_key: entity_id}, locale_code=locale)
            db.add(target)
        for key, value in fields.items():
            setattr(target, key, value)
        target.review_status = TranslationReviewStatus.MANUAL
        target.source_revision = entity.source_revision
        target.profile_fingerprint = profile_fingerprint(db, kind, locale)[1]
        target.provider = "manual"
        target.model = None
        snapshot(db, kind, entity, target)
        db.commit()
        if kind == "location":
            from knut_vandrar_backend.api.locations import read_location

            return read_location(db, entity, request, locale)
        return read_authored(db, kind, entity, locale)

    @router.put("/{entity_id}/translations/{locale}/review", response_model=ReviewWrite)
    def review(entity_id: UUID, locale: str, payload: ReviewWrite, db: DatabaseSession) -> Any:
        require(db, entity_id, locale)
        target = translation_for(db, kind, entity_id, locale)
        if target is None:
            raise HTTPException(404, "Translation not found")
        if payload.review_status == TranslationReviewStatus.SOURCE:
            raise HTTPException(422, "Only English is source content")
        target.review_status = payload.review_status
        db.commit()
        return {"review_status": target.review_status}

    from knut_vandrar_backend.api.schemas.photo import PhotoEnglish, PhotoRead

    schemas: dict[str, type[BaseModel]] = {
        "photo": PhotoEnglish,
        "location": LocationEnglish,
        "region": RegionEnglish,
        "achievement": AchievementEnglish,
    }
    responses: dict[str, type[BaseModel]] = {
        "photo": PhotoRead,
        "location": LocationRead,
        "region": RegionRead,
        "achievement": AchievementRead,
    }
    override.__annotations__["payload"] = schemas[kind]
    router.add_api_route(
        "/{entity_id}/translations/{locale}",
        override,
        methods=["PUT"],
        response_model=responses[kind],
        name=f"override_{kind}_translation",
    )
    return router


regions_router = authored_router("region", "/api/regions", RegionWrite, RegionRead)
achievements_router = authored_router(
    "achievement", "/api/achievements", AchievementWrite, AchievementRead
)
