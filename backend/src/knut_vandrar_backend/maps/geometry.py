"""Lossless GPX-to-GeoJSON conversion independent of any map renderer."""

import hashlib
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.enums import HikeStatus, RouteScope
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
from knut_vandrar_backend.tracks.gpx import MAX_GPX_BYTES, NS, normalize, track_path
from knut_vandrar_backend.tracks.selection import validate_selection


def segments(data: bytes, *, include_elevation: bool = False) -> list[list[list[float]]]:
    normalize(data, "Validation")
    root = ET.fromstring(data)
    result = []
    for segment in root.findall(f".//{NS}trkseg"):
        points = []
        for point in segment.findall(NS + "trkpt"):
            coordinates = [float(point.attrib["lon"]), float(point.attrib["lat"])]
            elevation = point.findtext(NS + "ele")
            if include_elevation and elevation is not None:
                height = float(elevation)
                if math.isfinite(height):
                    coordinates.append(height)
            points.append(coordinates)
        if len(points) < 2:
            raise ValueError("GPX contains an empty or single-point segment")
        if any(abs(point[1]) > 85.05112878 for point in points):
            raise ValueError("Route exceeds the Web Mercator latitude limit")
        result.append(points)
    if not result:
        raise ValueError("No track segments in GPX")
    return result


def distance(a: list[float], b: list[float]) -> float:
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, math.radians(b[0] - a[0])
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6_371_008.8 * 2 * math.asin(min(1, math.sqrt(value)))


def route_data(
    db: Session,
    hike: Hike,
    media_root: Path,
    circular_threshold: float,
    *,
    include_remaining: bool = False,
    include_elevation: bool = False,
) -> dict[str, Any]:
    if hike.track_collection_id is None:
        raise ValueError("No GPX collection selected")
    validate_selection(db, hike.id, hike.location_id, hike.track_collection_id)
    collection = db.get(TrackCollection, hike.track_collection_id)
    if collection is None:
        raise ValueError("Selected collection is missing")
    details = collection.details
    if (
        details.get("incomplete")
        or details.get("errors")
        or not details.get("membership_complete", True)
    ):
        raise ValueError("GPX collection is incomplete")
    removed = set(details.get("removed_source_ids", []))
    routes = [
        r
        for r in db.scalars(select(TrackRoute).where(TrackRoute.collection_id == collection.id))
        if r.source_id not in removed
    ]
    orders = [r.details.get("source_order") for r in routes]
    if (
        not routes
        or any(type(order) is not int or order < 0 for order in orders)
        or len(set(orders)) != len(orders)
    ):
        raise ValueError("Collection requires unique, valid Plotaroute ordering")
    routes.sort(key=lambda r: r.details["source_order"])
    if (
        collection.hike_id is None
        and hike.route_scope == RouteScope.TRAIL_SECTION
        and hike.start_stage is None
    ):
        raise ValueError("Trail-section hikes require a stage range or a custom GPX collection")
    if collection.hike_id is None and hike.start_stage is not None and hike.end_stage is not None:
        lower, upper = sorted((hike.start_stage, hike.end_stage))
        stages = []
        for route in routes:
            value = str({**route.details, **route.overrides}.get("stage", ""))
            match = re.fullmatch(r"(\d+)(?:[A-Za-z]+|(?:\.\d+)+)?", value)
            if not match:
                raise ValueError("Trail stage labels cannot be mapped to the hike's stage range")
            stages.append(int(match.group(1)))
        if lower not in stages or upper not in stages:
            raise ValueError("Hike's stage boundaries are missing in the selected collection")
        # Trail networks can skip official numbers along a valid itinerary.
        # Slice the authoritative collection order between the selected boundaries.
        boundary_indices = [i for i, stage in enumerate(stages) if stage in (lower, upper)]
        end_index = len(routes) if include_remaining else max(boundary_indices) + 1
        routes = routes[min(boundary_indices) : end_index]
    features: list[dict[str, Any]] = []
    for route in routes:
        path = track_path(media_root, route.digest)
        if not path.is_file() or path.stat().st_size > MAX_GPX_BYTES:
            raise ValueError(f"Missing or oversized GPX for route {route.source_id}")
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != route.digest:
            raise ValueError(f"GPX checksum mismatch for route {route.source_id}")
        lines = segments(raw, include_elevation=include_elevation)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "sourceId": route.source_id,
                    "stage": {**route.details, **route.overrides}.get("stage"),
                },
                "geometry": {"type": "MultiLineString", "coordinates": lines},
            }
        )
    points = [p for f in features for line in f["geometry"]["coordinates"] for p in line]
    # Unwrap longitude for framing at the antimeridian; preserve original GeoJSON coordinates.
    longitudes = sorted({p[0] % 360 for p in points})
    gaps = [
        (longitudes[(i + 1) % len(longitudes)] + (360 if i == len(longitudes) - 1 else 0) - lon, i)
        for i, lon in enumerate(longitudes)
    ]
    _, gap_index = max(gaps)
    west = longitudes[(gap_index + 1) % len(longitudes)]
    east = longitudes[gap_index] + (360 if longitudes[gap_index] < west else 0)
    if west > 180:
        west, east = west - 360, east - 360
    start, finish = points[0], points[-1]
    labels = {}
    # Some collections order stages correctly but store GPX files in opposite directions.
    # Locate each outer boundary without changing file direction or joining segments.
    for key, index, neighbor, default in (("start", 0, 1, 0), ("finish", -1, -2, 1)):
        lines = features[index]["geometry"]["coordinates"]
        endpoints = [lines[0][0], lines[-1][-1]]
        choice = default
        if len(features) > 1 and distance(points[0], points[-1]) > circular_threshold:
            adjacent = features[neighbor]["geometry"]["coordinates"]
            joins = [adjacent[0][0], adjacent[-1][-1]]
            scores = [min(distance(endpoint, join) for join in joins) for endpoint in endpoints]
            if min(scores) <= max(circular_threshold, 50) and abs(scores[0] - scores[1]) > 1:
                choice = 0 if scores[0] > scores[1] else 1
        metadata = {**routes[index].details, **routes[index].overrides}
        labels[key] = metadata.get("start" if choice == 0 else "end") or (
            hike.start_point if key == "start" else hike.end_point
        )
        if key == "start":
            start = endpoints[choice]
        else:
            finish = endpoints[choice]
    # A trail collection's file order need not match this hike's travel direction.
    # Assign endpoints using the hike's stage boundaries; preserve GPX geometry/order.
    first_stage = re.match(
        r"\d+", str({**routes[0].details, **routes[0].overrides}.get("stage", ""))
    )
    if (
        collection.hike_id is None
        and hike.start_stage is not None
        and hike.end_stage is not None
        and hike.start_stage != hike.end_stage
        and first_stage is not None
        and int(first_stage.group()) == hike.end_stage
    ):
        start, finish = finish, start
        labels = {"start": labels["finish"], "finish": labels["start"]}
    return {
        "completed": hike.status == HikeStatus.COMPLETED,
        "geojson": {"type": "FeatureCollection", "features": features},
        "bounds": [[west, min(p[1] for p in points)], [east, max(p[1] for p in points)]],
        "labels": labels,
        "start": start,
        "finish": finish,
        "circular": distance(start, finish) <= circular_threshold,
    }
