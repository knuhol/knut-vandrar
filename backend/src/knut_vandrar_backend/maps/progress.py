"""Project a stopping fix onto an ordered route without connecting track segments."""

import math
import re
from typing import Any

from knut_vandrar_backend.maps.geometry import distance


def orient_features(route: dict[str, Any]) -> list[dict[str, Any]]:
    """Orient a mutable route in hike order without joining GPX tracks."""
    ordered: list[dict[str, Any]] = route["geojson"]["features"]
    if route.get("start") is not None:
        start = route["start"]
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
    return ordered


def project_stop(
    ordered: list[dict[str, Any]], latitude: float, longitude: float, stage: str | None = None
) -> dict[str, Any]:
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        raise ValueError("Invalid stopping coordinates")
    candidates = []
    fix = [longitude, latitude]
    scale = math.cos(math.radians(latitude))
    for fi, feature in enumerate(ordered):
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
    return {
        "coordinates": projected,
        "line": sum(len(feature["geometry"]["coordinates"]) for feature in ordered[:stop_feature])
        + stop_segment,
        "edge": stop_edge,
    }
