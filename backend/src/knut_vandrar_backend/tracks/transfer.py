"""Track assets in the shared media archive; no network access during transfers."""

from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.media.archive import MediaError
from knut_vandrar_backend.models.enums import LocationKind
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.location import HikingLocation
from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
from knut_vandrar_backend.tracks.gpx import normalize, store, track_path


def payload(db: Session, kind: str, identifier: UUID) -> dict[str, Any] | None:
    if kind == "collection":
        collection = db.get(TrackCollection, identifier)
        if collection is None:
            return None
        return {
            "source_id": collection.source_id,
            "name": collection.name,
            "direction": collection.direction,
            "details": collection.details,
        }
    route = db.get(TrackRoute, identifier)
    if route is None:
        return None
    return {
        "collection_id": str(route.collection_id),
        "source_id": route.source_id,
        "details": route.details,
        "overrides": route.overrides,
    }


def plan(db: Session, asset: Any, media_root: Path) -> str:
    owner = (
        db.get(Hike, asset.owner_id)
        if asset.track_owner == "hike"
        else db.get(HikingLocation, asset.owner_id)
    )
    if owner is None or (isinstance(owner, HikingLocation) and owner.kind != LocationKind.TRAIL):
        raise MediaError("Track assets require an existing destination trail or hike")
    row = (
        db.get(TrackCollection, asset.id)
        if asset.kind == "collection"
        else db.get(TrackRoute, asset.id)
    )
    if asset.kind == "collection":
        conflict = db.scalar(
            select(TrackCollection).where(
                TrackCollection.location_id
                == (asset.owner_id if asset.track_owner == "trail" else None),
                TrackCollection.hike_id
                == (asset.owner_id if asset.track_owner == "hike" else None),
                TrackCollection.source_id == asset.track_data["source_id"],
            )
        )
        if conflict is not None and conflict.id != asset.id:
            raise MediaError("Destination already has this source collection with a different ID")
        if isinstance(row, TrackCollection) and (
            row.location_id != (asset.owner_id if asset.track_owner == "trail" else None)
            or row.hike_id != (asset.owner_id if asset.track_owner == "hike" else None)
        ):
            raise MediaError("Collection belongs to another trail or hike")
    elif (
        isinstance(row, TrackRoute) and str(row.collection_id) != asset.track_data["collection_id"]
    ):
        raise MediaError("Route belongs to another collection")
    if row is None:
        return "add"
    same = payload(db, asset.kind, asset.id) == asset.track_data
    if asset.kind == "gpx":
        digest = asset.files["track"].sha256
        same = same and isinstance(row, TrackRoute) and row.digest == digest
        path = track_path(media_root, digest)
        if same and not path.exists():
            return "repair"
        if path.exists():
            import hashlib

            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise MediaError("Destination track checksum mismatch")
    return "skip" if same else "replace"


def apply(db: Session, asset: Any, staging: Path, media_root: Path, source_id: str) -> None:
    target: TrackCollection | TrackRoute | None
    data = asset.track_data
    if asset.kind == "collection":
        target = db.get(TrackCollection, asset.id)
        if target is None:
            target = TrackCollection(
                id=asset.id,
                location_id=asset.owner_id if asset.track_owner == "trail" else None,
                hike_id=asset.owner_id if asset.track_owner == "hike" else None,
            )
            db.add(target)
    else:
        collection = db.get(TrackCollection, UUID(data["collection_id"]))
        if (
            collection is None
            or collection.location_id != (asset.owner_id if asset.track_owner == "trail" else None)
            or collection.hike_id != (asset.owner_id if asset.track_owner == "hike" else None)
        ):
            raise MediaError("Missing or mismatched destination collection")
        target = db.get(TrackRoute, asset.id)
        duplicate = db.scalar(
            select(TrackRoute).where(
                TrackRoute.collection_id == collection.id, TrackRoute.source_id == data["source_id"]
            )
        )
        if duplicate is not None and duplicate.id != asset.id:
            raise MediaError("Duplicate source route with different destination ID")
        if target is None:
            target = TrackRoute(id=asset.id, collection_id=collection.id)
            db.add(target)
        raw = (staging / "gpx" / source_id / "track").read_bytes()
        normalize(raw, "Validation")
        # Content-addressed immutable files are harmless if SQL rolls back; never remove old bytes.
        target.digest = store(media_root, raw)
    for key, value in data.items():
        setattr(target, key, UUID(value) if key == "collection_id" else value)
    db.flush()
