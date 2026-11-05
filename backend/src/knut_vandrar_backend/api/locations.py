"""Location API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.schemas.location import LocationCreate, LocationRead
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.location import Location

router = APIRouter(prefix="/api/locations", tags=["locations"])
DatabaseSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[LocationRead])
def get_locations(db: DatabaseSession) -> list[Location]:
    return list(db.scalars(select(Location).order_by(Location.id)).all())


@router.get("/{location_id}", response_model=LocationRead)
def get_location(location_id: int, db: DatabaseSession) -> Location:
    location = db.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
def create_location(payload: LocationCreate, db: DatabaseSession) -> Location:
    location = Location(**payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location
