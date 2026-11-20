"""Validate the explicit collection selected by a hike."""

from uuid import UUID

from sqlalchemy.orm import Session

from knut_vandrar_backend.models.track import TrackCollection


def validate_selection(
    db: Session, hike_id: UUID, location_id: UUID | None, collection_id: UUID | None
) -> None:
    if collection_id is None:
        return
    collection = db.get(TrackCollection, collection_id)
    if collection is None:
        raise ValueError("Track collection not found")
    if collection.hike_id == hike_id:
        return
    if (
        collection.hike_id is None
        and location_id is not None
        and collection.location_id == location_id
    ):
        return
    raise ValueError("Select this hike's custom collection or a collection belonging to its trail")
