"""Incremental draft persistence and atomic publication of reviewed collections."""

import copy
import re
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.track import TrackCollection, TrackDraft, TrackRoute
from knut_vandrar_backend.tracks.gpx import clean_name, endpoints, normalize, store

FIELDS = ("name", "stage", "start", "end")


def save_draft(factory: sessionmaker[Session], draft_id: UUID, data: dict[str, Any]) -> None:
    with factory.begin() as db:
        draft = db.get(TrackDraft, draft_id)
        if draft is None:
            raise ValueError("Draft no longer exists")
        draft.data = copy.deepcopy(data)


def ingest(data: dict[str, Any], item: dict[str, Any], staging: Path) -> None:
    if "collection_name" in item:
        data["source_name"] = item["collection_name"]
        data["expected"] = item["expected"]
        data["membership_complete"] = item.get("membership_complete", True)
        return
    identifier = item["source_id"]
    if identifier not in data["seen"]:
        data["seen"].append(identifier)
    if item.get("skipped"):
        return
    if "error" in item:
        data["errors"][identifier] = item["error"]
        return
    metadata = item["metadata"]
    name = clean_name(metadata["RouteName"])
    start, end = endpoints(metadata.get("About", ""))
    if start is None:
        start, end = endpoints(name)
    content, geometry = normalize(Path(item["path"]).read_bytes(), name)
    digest = store(staging, content)
    previous = data["routes"].get(identifier, {})
    stage_match = re.search(r"(\d+[\w.]*)$", name)
    source = {
        "name": name,
        "stage": stage_match.group(1) if stage_match else "",
        "start": start,
        "end": end,
        "order": item["source_order"],
        "source_order": item["source_order"],
        "source": metadata,
        "source_digest": digest,
        "geometry": geometry,
    }
    changed = (
        previous.get("details") != source
        or previous.get("details", {}).get("source_digest", previous.get("digest")) != digest
    )
    data["routes"][identifier] = {
        "details": source,
        "digest": digest,
        "overrides": {
            key: value for key, value in previous.get("overrides", {}).items() if key != "order"
        },
        "reviewed": False if changed else previous.get("reviewed", False),
    }
    data["errors"].pop(identifier, None)


def publish(db: Session, draft: TrackDraft, staging: Path, media_root: Path) -> None:
    data = draft.data
    routes = data["routes"]
    if not data.get("discovered") or not routes or any(not r["reviewed"] for r in routes.values()):
        raise ValueError("Finish discovery and review all downloaded stages first")
    collection = db.scalar(
        select(TrackCollection)
        .where(
            TrackCollection.location_id == draft.location_id,
            TrackCollection.hike_id == draft.hike_id,
            TrackCollection.source_id == draft.source_id,
        )
        .with_for_update()
    )
    if collection is None:
        collection = TrackCollection(
            location_id=draft.location_id, hike_id=draft.hike_id, source_id=draft.source_id
        )
        db.add(collection)
    collection.name = data["name"]
    collection.direction = data["direction"] if draft.location_id is not None else None
    collection.details = {
        "source_name": data.get("source_name"),
        "errors": data["errors"],
        "incomplete": bool(data["errors"]),
        "membership_complete": data.get("membership_complete", True),
    }
    db.flush()
    existing = {
        r.source_id: r
        for r in db.scalars(select(TrackRoute).where(TrackRoute.collection_id == collection.id))
    }
    for identifier, route in routes.items():
        from knut_vandrar_backend.tracks.gpx import track_path

        raw = track_path(staging, route["digest"]).read_bytes()
        # Apply editorial names to the downloadable file too.
        raw, _ = normalize(raw, route["overrides"].get("name", route["details"]["name"]))
        digest = store(media_root, raw)
        target = existing.get(identifier)
        if target is None:
            target = TrackRoute(collection_id=collection.id, source_id=identifier)
            db.add(target)
        target.details = route["details"]
        target.overrides = route["overrides"]
        target.digest = digest
    removed = (
        sorted(set(existing) - set(data["seen"])) if data.get("membership_complete", True) else []
    )
    collection.details = {**collection.details, "removed_source_ids": removed}
    if draft.hike_id is not None:
        hike = db.get(Hike, draft.hike_id)
        if hike is None:
            raise ValueError("Destination hike no longer exists")
        hike.track_collection_id = collection.id
    db.delete(draft)
