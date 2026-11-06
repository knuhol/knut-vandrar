"""Public CRUD endpoints and logo image delivery for reusable trails."""

import hashlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.image_uploads import (
    IMAGE_RESPONSES,
    ImageBody,
    image_response,
    optimize_image,
)
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.api.schemas.trail import TrailRead, TrailWrite
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.trail import Trail, TrailCountry, TrailLogo

router = APIRouter(prefix="/api/trails", tags=["trails"])
DatabaseSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=Page[TrailRead])
def list_trails(
    request: Request, db: DatabaseSession, limit: Limit = 10, offset: Offset = 0
) -> Page[TrailRead]:
    total = db.scalar(select(func.count()).select_from(Trail)) or 0
    trails = db.scalars(
        select(Trail).order_by(Trail.name, Trail.id).limit(limit).offset(offset)
    ).all()
    return Page(
        items=[_to_read(trail, request) for trail in trails],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=TrailRead, status_code=status.HTTP_201_CREATED)
def create_trail(payload: TrailWrite, request: Request, db: DatabaseSession) -> TrailRead:
    trail = Trail(
        name=payload.name,
        type=payload.type,
        official_url=str(payload.official_url) if payload.official_url else None,
    )
    db.add(trail)
    db.flush()
    trail.countries = [TrailCountry(country_code=code) for code in payload.country_codes]
    db.commit()
    db.refresh(trail)
    return _to_read(trail, request)


@router.get("/{trail_id}", response_model=TrailRead)
def get_trail(trail_id: UUID, request: Request, db: DatabaseSession) -> TrailRead:
    trail = db.get(Trail, trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    return _to_read(trail, request)


@router.put("/{trail_id}", response_model=TrailRead)
def update_trail(
    trail_id: UUID, payload: TrailWrite, request: Request, db: DatabaseSession
) -> TrailRead:
    trail = db.get(Trail, trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    trail.name = payload.name
    trail.type = payload.type
    trail.official_url = str(payload.official_url) if payload.official_url else None
    trail.countries = [TrailCountry(country_code=code) for code in payload.country_codes]
    db.commit()
    db.refresh(trail)
    return _to_read(trail, request)


@router.delete("/{trail_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trail(trail_id: UUID, db: DatabaseSession) -> Response:
    trail = db.get(Trail, trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    if trail.hikes:
        raise HTTPException(status_code=409, detail="Trail is still associated with hikes")
    db.delete(trail)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/{trail_id}/logo",
    response_model=TrailRead,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            },
        }
    },
)
def upload_trail_logo(
    trail_id: UUID, content: ImageBody, request: Request, db: DatabaseSession
) -> TrailRead:
    """Store a PNG, JPEG, WebP, GIF, or SVG logo and return its backend URL."""
    trail = db.get(Trail, trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    content, content_type = optimize_image(content, max_dimension=512, lossless=True)
    logo = trail.logo or TrailLogo(trail_id=trail.id)
    logo.content_type = content_type
    logo.content = content
    logo.sha256 = hashlib.sha256(content).hexdigest()
    trail.logo = logo
    db.commit()
    db.refresh(trail)
    return _to_read(trail, request)


@router.get(
    "/{trail_id}/logo",
    name="get_trail_logo",
    response_class=Response,
    responses=IMAGE_RESPONSES,
)
def get_trail_logo(trail_id: UUID, request: Request, db: DatabaseSession) -> Response:
    trail = db.get(Trail, trail_id)
    if trail is None or trail.logo is None:
        raise HTTPException(status_code=404, detail="Trail logo not found")
    return image_response(trail.logo.content, trail.logo.content_type, trail.logo.sha256, request)


@router.delete("/{trail_id}/logo", status_code=status.HTTP_204_NO_CONTENT)
def delete_trail_logo(trail_id: UUID, db: DatabaseSession) -> Response:
    trail = db.get(Trail, trail_id)
    if trail is None:
        raise HTTPException(status_code=404, detail="Trail not found")
    if trail.logo is not None:
        trail.logo = None
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _to_read(trail: Trail, request: Request) -> TrailRead:
    return TrailRead(
        id=trail.id,
        name=trail.name,
        type=trail.type,
        country_codes=sorted(country.country_code for country in trail.countries),
        official_url=trail.official_url,
        logo_url=(
            str(request.url_for("get_trail_logo", trail_id=str(trail.id)))
            if trail.logo is not None
            else None
        ),
    )
