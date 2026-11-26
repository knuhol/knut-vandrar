"""Project an ordered prefix of Garmin fixes onto the planned route."""

from collections import defaultdict
from dataclasses import dataclass
from math import atan2, cos, degrees, floor, radians

from knut_vandrar_backend.maps.geometry import distance
from knut_vandrar_backend.tracking.garmin import Fix

MAX_OFFSET = 180
CELL = 0.01


@dataclass(frozen=True)
class Edge:
    line: int
    index: int
    start: float
    length: float
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class Projection:
    edge: Edge
    fraction: float
    coordinates: list[float]
    offset: float
    distance: float
    fix: Fix


def _longitude(value: float, origin: float) -> float:
    if abs(value - origin) <= 180:
        return value
    return origin + (value - origin + 180) % 360 - 180


class Route:
    def __init__(self, lines: list[list[list[float]]], origin: float):
        self.total = 0.0
        self.origin = origin
        self.cells: dict[tuple[int, int], list[Edge]] = defaultdict(list)
        self.long_edges: list[Edge] = []
        for li, line in enumerate(lines):
            for pi, (a, b) in enumerate(zip(line, line[1:], strict=False)):
                length = distance(a, b)
                if not length:
                    continue
                edge = Edge(li, pi, self.total, length, self.unwrap(a), self.unwrap(b))
                self.total += length
                x, y = self._cells(edge.a, edge.b)
                if len(x) * len(y) > 128:
                    self.long_edges.append(edge)
                    continue
                for i in x:
                    for j in y:
                        self.cells[i, j].append(edge)

    def unwrap(self, point: list[float]) -> list[float]:
        return [_longitude(point[0], self.origin), point[1]]

    @staticmethod
    def _cells(a: list[float], b: list[float]) -> tuple[range, range]:
        x, y = (
            range(floor(min(start, end) / CELL), floor(max(start, end) / CELL) + 1)
            for start, end in zip(a, b, strict=True)
        )
        return x, y

    def candidates(self, fix: Fix, coordinates: list[float]) -> list[Projection]:
        lon, lat = self.unwrap(coordinates)
        scale = cos(radians(lat))
        if abs(lat) > 85.05112878:
            return []
        radius = MAX_OFFSET / 110_000
        x, y = self._cells(
            [lon - radius / scale, lat - radius], [lon + radius / scale, lat + radius]
        )
        edges = {(edge.line, edge.index): edge for edge in self.long_edges}
        for i in x:
            for j in y:
                for edge in self.cells.get((i, j), ()):
                    edges[edge.line, edge.index] = edge
        candidates = []
        for edge in edges.values():
            ax, ay = (edge.a[0] - lon) * scale, edge.a[1] - lat
            dx, dy = (edge.b[0] - edge.a[0]) * scale, edge.b[1] - edge.a[1]
            fraction = min(1.0, max(0.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
            point = [
                edge.a[0] + fraction * (edge.b[0] - edge.a[0]),
                edge.a[1] + fraction * dy,
            ]
            offset = distance(point, coordinates)
            if offset <= MAX_OFFSET:
                candidates.append(
                    Projection(
                        edge, fraction, point, offset, edge.start + fraction * edge.length, fix
                    )
                )
        return candidates


def match(
    route: Route,
    fixes: list[Fix],
    *,
    backtracking: bool,
    accepted: list[Projection] | None = None,
) -> tuple[Projection | None, float]:
    previous = None
    furthest = 0.0
    for fix in fixes:
        coordinates = fix.data["coordinates"]
        if coordinates is None:
            continue
        candidates = []
        for candidate in route.candidates(fix, coordinates):
            score = candidate.offset
            if previous:
                delta = candidate.distance - previous.distance
                elapsed = (fix.recorded_at - previous.fix.recorded_at).total_seconds()
                displacement = distance(candidate.coordinates, previous.coordinates)
                if abs(delta) > 120 + 3 * elapsed:
                    continue
                score += max(0, abs(delta) - 1.5 * displacement) * 0.18
                if delta < 0:
                    score += 12
                course = fix.data.get("course")
                if course is not None and (fix.data.get("velocity") or 0) >= 2:
                    edge = candidate.edge
                    bearing = degrees(
                        atan2(
                            (edge.b[0] - edge.a[0]) * cos(radians(coordinates[1])),
                            edge.b[1] - edge.a[1],
                        )
                    )
                    heading = bearing + (180 if delta < 0 else 0)
                    score += abs((heading - course + 180) % 360 - 180) / 6
            else:
                score += min(candidate.distance / 100, 20)
            candidates.append((score, candidate))
        if not candidates:
            continue
        candidates.sort(key=lambda item: (item[0], item[1].distance))
        score, best = candidates[0]
        if any(
            other_score < score + 12 and abs(other.distance - best.distance) > 250
            for other_score, other in candidates[1:]
        ):
            continue
        if previous and best.distance < previous.distance and not backtracking:
            continue
        if accepted is not None:
            accepted.append(best)
        previous = best
        furthest = max(furthest, best.distance)
    return previous, furthest
