"""Project a stopping fix onto an ordered route without connecting track segments."""

import copy
import math
import re
from typing import Any

from knut_vandrar_backend.maps.geometry import distance


def split_at_stop(
    route: dict[str, Any], latitude: float, longitude: float, stage: str | None = None
) -> dict[str, Any]:
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        raise ValueError("Invalid stopping coordinates")
    result = copy.deepcopy(route)
    ordered = result["geojson"]["features"]
    if result.get("start") is not None:
        start = result["start"]
        first = ordered[0]["geometry"]["coordinates"]
        last = ordered[-1]["geometry"]["coordinates"]
        if min(distance(start, p) for p in (last[0][0], last[-1][-1])) < min(
            distance(start, p) for p in (first[0][0], first[-1][-1])
        ):
            ordered.reverse()
        previous = start
        for feature in ordered:
            lines = feature["geometry"]["coordinates"]
            if distance(previous, lines[-1][-1]) < distance(previous, lines[0][0]):
                lines[:] = [list(reversed(line)) for line in reversed(lines)]
            previous = lines[-1][-1]
    candidates = []
    fix = [longitude, latitude]
    scale = math.cos(math.radians(latitude))
    for fi, feature in enumerate(result["geojson"]["features"]):
        label = str(feature["properties"].get("stage", ""))
        if (
            stage is not None
            and label != stage
            and not (stage.isdigit() and re.fullmatch(re.escape(stage) + r"[A-Za-z]+", label))
        ):
            continue
        for si, segment in enumerate(feature["geometry"]["coordinates"]):
            for pi, (a, b) in enumerate(zip(segment, segment[1:], strict=False)):
                ax, ay = (a[0] - longitude) * scale, a[1] - latitude
                bx, by = (b[0] - longitude) * scale, b[1] - latitude
                dx, dy = bx - ax, by - ay
                fraction = (
                    min(1.0, max(0.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
                    if dx or dy
                    else 0
                )
                point = [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])]
                candidates.append((distance(fix, point), fi, si, pi, point))
    if not candidates:
        raise ValueError("Stopping stage not found in the selected hike route")
    offset, stop_feature, stop_segment, stop_edge, projected = min(candidates)
    if offset > 1000:
        raise ValueError("Stopping coordinate is more than 1 km from its stage")
    matched_stage = result["geojson"]["features"][stop_feature]["properties"].get("stage")
    features = []
    for fi, feature in enumerate(result["geojson"]["features"]):
        for si, segment in enumerate(feature["geometry"]["coordinates"]):
            pieces = []
            if (fi, si) < (stop_feature, stop_segment):
                pieces = [("walked", segment)]
            elif (fi, si) > (stop_feature, stop_segment):
                pieces = [("remaining", segment)]
            else:
                pieces = [
                    ("walked", segment[: stop_edge + 1] + [projected]),
                    ("remaining", [projected] + segment[stop_edge + 1 :]),
                ]
            for status, coordinates in pieces:
                features.append(
                    {
                        "type": "Feature",
                        "properties": {**feature["properties"], "progress": status},
                        "geometry": {"type": "MultiLineString", "coordinates": [coordinates]},
                    }
                )
    result["geojson"]["features"] = features
    result["stop"] = {
        "coordinates": projected,
        "recorded": fix,
        "stage": stage or str(matched_stage or ""),
        "offsetMetres": round(offset, 2),
    }
    return result
