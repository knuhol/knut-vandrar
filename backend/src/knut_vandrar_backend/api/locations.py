"""Destination CRUD and reusable localized response construction."""

import hashlib
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.image_uploads import (
    IMAGE_RESPONSES,
    ImageBody,
    image_response,
    optimize_image,
)
from knut_vandrar_backend.api.schemas.location import (
    LocationRead,
    LocationWrite,
    RatingWrite,
    RegionRead,
    TranslationMetadata,
)
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.location import (
    HikingLocation,
    LocationCountry,
    LocationLogo,
    LocationMonth,
    LocationOvernightOption,
    LocationRating,
    LocationRegion,
    LocationRestriction,
    LocationTerrain,
    LocationWaterSource,
    Region,
)
from knut_vandrar_backend.translations.content import localized, set_source

router = APIRouter(prefix="/api/locations", tags=["locations"])
DatabaseSession = Annotated[Session, Depends(get_db)]
COLLECTIONS: dict[str, tuple[Any, str]] = {
    "country_codes": (LocationCountry, "country_code"),
    "terrains": (LocationTerrain, "terrain"),
    "region_ids": (LocationRegion, "region_id"),
    "hiking_months": (LocationMonth, "month"),
    "water_sources": (LocationWaterSource, "source_type"),
    "overnight_options": (LocationOvernightOption, "accommodation_type"),
    "overnight_restrictions": (LocationRestriction, "restriction_type"),
}
# Preserve unknown vs explicitly known months independently of the month rows.


def require_location(db: Session, location_id: UUID) -> HikingLocation:
    entity = db.get(HikingLocation, location_id)
    if entity is None:
        raise HTTPException(404, "Location not found")
    return entity


def read_region(db: Session, entity: Region, locale: str) -> RegionRead:
    text, metadata = localized(db, "region", entity, locale)
    return RegionRead(id=entity.id, name=text.name, translation=TranslationMetadata(**metadata))


def read_location(
    db: Session, entity: HikingLocation, request: Request, locale: str
) -> LocationRead:
    text, metadata = localized(db, "location", entity, locale)
    values: dict[str, Any] = {}
    for key, (model, column) in COLLECTIONS.items():
        values[key] = list(
            db.scalars(
                select(getattr(model, column))
                .where(model.location_id == entity.id)
                .order_by(getattr(model, column))
            ).all()
        )
    values["regions"] = [
        read_region(db, region, locale)
        for region_id in values.pop("region_ids")
        if (region := db.get(Region, region_id)) is not None
    ]
    if not entity.hiking_months_known:
        values["hiking_months"] = None
    rating = db.get(LocationRating, entity.id)
    return LocationRead(
        id=entity.id,
        kind=entity.kind,
        official_url=entity.official_url,
        logo_url=str(request.url_for("get_location_logo", location_id=str(entity.id)))
        if db.get(LocationLogo, entity.id)
        else None,
        waymarking=entity.waymarking,
        is_loop=entity.is_loop,
        arctic_circle_position=entity.arctic_circle_position,
        information_checked_at=entity.information_checked_at,
        water_sources_status=entity.water_sources_status,
        overnight_options_status=entity.overnight_options_status,
        overnight_restrictions_status=entity.overnight_restrictions_status,
        name=text.name,
        season_note=text.season_note,
        overnight_restrictions_note=text.overnight_restrictions_note,
        ratings=RatingWrite.model_validate(rating, from_attributes=True) if rating else None,
        translation=TranslationMetadata(**metadata),
        **values,
    )


def save_location(db: Session, entity: HikingLocation, payload: LocationWrite) -> None:
    for region_id in payload.region_ids:
        if db.get(Region, region_id) is None:
            raise HTTPException(422, "Unknown region")
    fields = payload.model_dump(exclude={"english", "ratings", *COLLECTIONS})
    fields["official_url"] = str(payload.official_url) if payload.official_url else None
    for key, value in fields.items():
        setattr(entity, key, value)
    entity.hiking_months_known = payload.hiking_months is not None
    db.add(entity)
    db.flush()
    for key, (model, column) in COLLECTIONS.items():
        db.execute(delete(model).where(model.location_id == entity.id))
        for value in getattr(payload, key) or []:
            db.add(model(location_id=entity.id, **{column: value}))
    rating = db.get(LocationRating, entity.id)
    if payload.ratings is None:
        if rating:
            db.delete(rating)
    else:
        if rating is None:
            rating = LocationRating(location_id=entity.id)
            db.add(rating)
        for key, value in payload.ratings.model_dump().items():
            setattr(rating, key, value)
    set_source(db, "location", entity, payload.english.model_dump())


@router.get("", response_model=Page[LocationRead])
def list_locations(
    request: Request, db: DatabaseSession, locale: str = "en", limit: Limit = 10, offset: Offset = 0
) -> Page[LocationRead]:
    entities = db.scalars(
        select(HikingLocation).order_by(HikingLocation.id).limit(limit).offset(offset)
    ).all()
    return Page(
        items=[read_location(db, entity, request, locale) for entity in entities],
        total=db.scalar(select(func.count()).select_from(HikingLocation)) or 0,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=LocationRead, status_code=201)
def create_location(payload: LocationWrite, request: Request, db: DatabaseSession) -> LocationRead:
    entity = HikingLocation()
    save_location(db, entity, payload)
    db.commit()
    return read_location(db, entity, request, "en")


@router.get("/{location_id}", response_model=LocationRead)
def get_location(
    location_id: UUID, request: Request, db: DatabaseSession, locale: str = "en"
) -> LocationRead:
    return read_location(db, require_location(db, location_id), request, locale)


@router.put("/{location_id}", response_model=LocationRead)
def update_location(
    location_id: UUID, payload: LocationWrite, request: Request, db: DatabaseSession
) -> LocationRead:
    entity = require_location(db, location_id)
    save_location(db, entity, payload)
    db.commit()
    return read_location(db, entity, request, "en")


@router.delete("/{location_id}", status_code=204)
def delete_location(location_id: UUID, db: DatabaseSession) -> Response:
    from knut_vandrar_backend.models.hike import Hike

    if db.scalar(select(Hike.id).where(Hike.location_id == location_id).limit(1)):
        raise HTTPException(409, "Location is still associated with hikes")
    db.delete(require_location(db, location_id))
    db.commit()
    return Response(status_code=204)


@router.put(
    "/{location_id}/logo",
    response_model=LocationRead,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            },
        }
    },
)
def upload_location_logo(
    location_id: UUID, content: ImageBody, request: Request, db: DatabaseSession
) -> LocationRead:
    entity = require_location(db, location_id)
    content, mime = optimize_image(content, max_dimension=512, lossless=True)
    logo = db.get(LocationLogo, location_id) or LocationLogo(location_id=location_id)
    logo.content, logo.content_type, logo.sha256 = (
        content,
        mime,
        hashlib.sha256(content).hexdigest(),
    )
    db.add(logo)
    db.commit()
    return read_location(db, entity, request, "en")


@router.get(
    "/{location_id}/logo",
    name="get_location_logo",
    response_class=Response,
    responses=IMAGE_RESPONSES,
)
def get_location_logo(location_id: UUID, request: Request, db: DatabaseSession) -> Response:
    logo = db.get(LocationLogo, location_id)
    if logo is None:
        raise HTTPException(404, "Logo not found")
    return image_response(logo.content, logo.content_type, logo.sha256, request)


@router.delete("/{location_id}/logo", status_code=204)
def delete_location_logo(location_id: UUID, db: DatabaseSession) -> Response:
    require_location(db, location_id)
    logo = db.get(LocationLogo, location_id)
    if logo:
        db.delete(logo)
    db.commit()
    return Response(status_code=204)
