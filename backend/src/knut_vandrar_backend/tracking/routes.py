"""Compile and cache an indexed route until the selected GPX inputs change."""

import hashlib
import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.maps.config import load_config
from knut_vandrar_backend.maps.geometry import route_data
from knut_vandrar_backend.maps.progress import orient_features, project_stop
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.tracking.match import Route

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CompiledRoute:
    revision: str
    lines: list[list[list[float]]]
    bounds: list[list[float]]
    start: list[float]
    finish: list[float]
    labels: dict[str, str | None]
    circular: bool
    index: Route
    stop: dict[str, Any] | None = None


@lru_cache(maxsize=1)
def presentation() -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
    config, style, tokens = load_config()
    style["sources"]["openmaptiles"]["attribution"] = (
        '<a href="https://openmaptiles.org/">©&nbsp;OpenMapTiles</a> '
        '<a href="https://www.openstreetmap.org/copyright">©&nbsp;OpenStreetMap contributors</a>'
    )
    for layer in style["layers"]:
        token = style.get("metadata", {}).get("vandrar:tokens", {}).get(layer["id"])
        if token:
            key = "background-color" if layer["type"] == "background" else "fill-color"
            layer.setdefault("paint", {})[key] = tokens[token]
            if layer["type"] == "fill":
                layer["paint"]["fill-opacity"] = 0.22
    return config, style, tokens


# Bounded to the current map working set. Entries are immutable after publication.
_cache: dict[str, CompiledRoute] = {}


def compiled_route(db: Session, hike: Hike) -> CompiledRoute:
    collection = (
        db.get(TrackCollection, hike.track_collection_id) if hike.track_collection_id else None
    )
    if collection is None:
        raise ValueError("No GPX collection selected")
    rows = db.execute(
        select(TrackRoute.source_id, TrackRoute.digest, TrackRoute.details, TrackRoute.overrides)
        .where(TrackRoute.collection_id == collection.id)
        .order_by(TrackRoute.source_id)
    )
    identity = [
        str(hike.id),
        str(hike.location_id),
        str(collection.id),
        str(collection.hike_id),
        str(collection.location_id),
        hike.start_stage,
        hike.end_stage,
        hike.route_scope,
        hike.status == HikeStatus.ABORTED,
        str(hike.stop_latitude),
        str(hike.stop_longitude),
        hike.stop_stage,
        hike.start_point,
        hike.end_point,
        collection.details,
        [list(row) for row in rows],
    ]
    revision = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    if cached := _cache.get(revision):
        return cached

    config, _, _ = presentation()
    data = route_data(
        db,
        hike,
        settings.media_root,
        config["circularThresholdMetres"],
        include_remaining=hike.status == HikeStatus.ABORTED and hike.stop_latitude is not None,
        include_elevation=True,
    )
    features = orient_features(data)
    lines = [line for feature in features for line in feature["geometry"]["coordinates"]]
    west, east = data["bounds"][0][0], data["bounds"][1][0]
    index = Route(lines, (west + east) / 2)
    if not index.total:
        raise ValueError("GPX collection has no measurable distance")
    stop = None
    if (
        hike.status == HikeStatus.ABORTED
        and hike.stop_latitude is not None
        and hike.stop_longitude is not None
    ):
        try:
            stop = project_stop(
                features, float(hike.stop_latitude), float(hike.stop_longitude), hike.stop_stage
            )
        except ValueError as exc:
            logger.info("Stop marker unavailable for hike %s: %s", hike.id, exc)
    result = CompiledRoute(
        revision,
        lines,
        data["bounds"],
        data["start"],
        data["finish"],
        data["labels"],
        data["circular"],
        index,
        stop,
    )
    if len(_cache) >= 16:
        _cache.clear()
    _cache[revision] = result
    return result
