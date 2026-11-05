"""Location API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from src.database.db_session import get_db
from src.models.location import Location

router = APIRouter(prefix="/api/locations", tags=["locations"])


class LocationCreate(BaseModel):
    name: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    visited: bool = False


class LocationRead(LocationCreate):
    id: int
    created_at: int | None = None

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[LocationRead])
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).order_by(Location.id).all()


@router.get("/{location_id}", response_model=LocationRead)
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = db.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    location = Location(**payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location
