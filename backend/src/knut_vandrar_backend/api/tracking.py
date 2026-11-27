"""Public route and progress reads, plus authenticated, read-only historical replay."""

import logging
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from statistics import median
from typing import Any, Literal
from uuid import UUID
from xml.etree.ElementTree import Element, ParseError, SubElement, tostring
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AwareDatetime, BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from knut_vandrar_backend.api.auth import require_admin_auth
from knut_vandrar_backend.api.hikes import DatabaseSession
from knut_vandrar_backend.maps.geometry import distance
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.tracking import (
    DEFAULT_TRACKING_INTERVAL_MINUTES,
    GarminPoint,
    GarminSettings,
    GarminSync,
)
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.tracking.garmin import MAX_KML_BYTES, Fix, parse_kml, utc
from knut_vandrar_backend.tracking.match import Projection, match
from knut_vandrar_backend.tracking.routes import CompiledRoute, compiled_route, presentation
from knut_vandrar_backend.tracking.worker import ongoing_hikes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hikes", tags=["tracking"])
FINISH_TOLERANCE_METRES = 50
FRESH_FIX_WINDOW = timedelta(minutes=30)
TRACKING_TIME_ZONE = ZoneInfo("Europe/Stockholm")
MINIMUM_ESTIMATE_AGE = timedelta(days=3)
TrackStatus = Literal["notStarted", "active", "awaiting", "stopped", "unavailable", "conflict"]


class MapOverlay(BaseModel):
    routeColorToken: str
    outlineColorToken: str
    startColorToken: str
    routeWidth: float
    outlineWidth: float
    markerRadius: float
    markerStrokeWidth: float


class RoutePoint(BaseModel):
    coordinates: list[float]
    line: int
    edge: int


class PlannedMap(BaseModel):
    revision: str
    lines: list[list[list[float]]]
    bounds: list[list[float]]
    start: list[float]
    finish: list[float]
    labels: dict[str, str | None]
    circular: bool
    total: float
    stop: RoutePoint | None = None
    style: dict[str, Any]
    overlay: MapOverlay
    tokens: dict[str, str]


class Position(RoutePoint):
    distance: float
    offset: float
    recorded_at: datetime


class Progress(BaseModel):
    revision: str
    status: TrackStatus
    position: Position | None = None
    first_recorded_at: datetime | None = None
    latest_recorded_at: datetime | None = None
    tracking_interval_minutes: int | None = None
    latest_retrieved_at: datetime | None = None
    average_metres_per_day: float | None = None
    walking_metres_per_hour: float | None = None
    current_walking_metres_per_hour: float | None = None
    completed: float
    remaining: float
    percentage: float
    backtracked: float


class Replay(BaseModel):
    route: PlannedMap | None = None
    progress: Progress
    start: datetime
    end: datetime


def _planned(route: CompiledRoute) -> PlannedMap:
    config, style, tokens = presentation()
    return PlannedMap(
        revision=route.revision,
        lines=route.lines,
        bounds=route.bounds,
        start=route.start,
        finish=route.finish,
        labels=route.labels,
        circular=route.circular,
        total=route.index.total,
        stop=RoutePoint.model_validate(route.stop) if route.stop else None,
        style=style,
        overlay=MapOverlay.model_validate(config["overlay"]),
        tokens=tokens,
    )


def _route(db: DatabaseSession, hike_id: UUID) -> CompiledRoute:
    hike = db.get(Hike, hike_id)
    if hike is None:
        raise HTTPException(404, "Dynamic map unavailable")
    try:
        return compiled_route(db, hike)
    except ValueError as exc:
        logger.info("Dynamic map unavailable for hike %s: %s", hike_id, exc)
        raise HTTPException(404, "Planned route unavailable") from exc


def _position(route: CompiledRoute, projection: Projection) -> Position:
    total = route.index.total
    finish = route.lines[-1][-1][:2]
    raw = projection.fix.data["coordinates"]
    if raw is not None and total - projection.distance <= FINISH_TOLERANCE_METRES:
        offset = distance(finish, raw)
        if offset <= FINISH_TOLERANCE_METRES:
            return Position(
                coordinates=finish,
                line=len(route.lines) - 1,
                edge=len(route.lines[-1]) - 2,
                distance=total,
                offset=offset,
                recorded_at=projection.fix.recorded_at,
            )
    return Position(
        coordinates=projection.coordinates,
        line=projection.edge.line,
        edge=projection.edge.index,
        distance=projection.distance,
        offset=projection.offset,
        recorded_at=projection.fix.recorded_at,
    )


def _local_midnight(now: datetime) -> datetime:
    local = now.astimezone(TRACKING_TIME_ZONE)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)


def _daily_distance(
    route: CompiledRoute, fixes: list[Fix], cutoff: datetime, *, replay: bool
) -> float:
    # Late transmissions count at the next checkpoint. Replay uses recorded time.
    checkpoint = [
        fix
        for fix in fixes
        if fix.recorded_at <= cutoff
        and (replay or fix.retrieved_at is None or fix.retrieved_at <= cutoff)
    ]
    projection, _ = match(route.index, checkpoint, backtracking=replay)
    return _position(route, projection).distance if projection else 0.0


def _current_walking_metres_per_hour(
    accepted: list[Projection], latest: Fix | None
) -> float | None:
    if len(accepted) < 2 or accepted[-1].fix != latest:
        return None
    previous, current = accepted[-2:]
    hours = (current.fix.recorded_at - previous.fix.recorded_at) / timedelta(hours=1)
    return abs(current.distance - previous.distance) / hours if hours > 0 else None


def _walking_metres_per_hour(accepted: list[Projection]) -> float | None:
    if len(accepted) < 4:
        return None
    cutoff = accepted[-1].fix.recorded_at - timedelta(days=2)
    speeds = []
    for index in range(len(accepted) - 1, 0, -1):
        previous, current = accepted[index - 1], accepted[index]
        if previous.fix.recorded_at < cutoff:
            break
        hours = (current.fix.recorded_at - previous.fix.recorded_at) / timedelta(hours=1)
        forward_metres = current.distance - previous.distance
        # Ignore jitter and long gaps that could include an overnight stop.
        if 0 < hours <= 0.75 and forward_metres >= max(30, 500 * hours):
            speeds.append(forward_metres / hours)
            if len(speeds) == 6:
                break
    return median(speeds) if len(speeds) >= 3 else None


def _progress(
    route: CompiledRoute,
    fixes: list[Fix],
    now: datetime,
    *,
    replay: bool = False,
    tracking_interval_minutes: int | None = None,
) -> Progress:
    # Replay and live matching see only the effective-time prefix.
    fixes = [fix for fix in fixes if fix.recorded_at <= now]
    accepted: list[Projection] = []
    projection, furthest = match(route.index, fixes, backtracking=replay, accepted=accepted)
    first = next((fix for fix in fixes if fix.data["valid"]), None)
    latest = next((fix for fix in reversed(fixes) if fix.data["valid"]), None)
    event = next(
        (
            fix.data["event"].lower()
            for fix in reversed(fixes)
            if "tracking turned" in fix.data["event"].lower()
        ),
        "",
    )
    status: TrackStatus = "notStarted"
    if event and "turned off" in event:
        status = "stopped"
    elif latest:
        status = "active" if now - latest.recorded_at < FRESH_FIX_WINDOW else "awaiting"
    elif event:
        status = "awaiting"

    position = _position(route, projection) if projection else None
    completed = position.distance if position else 0.0
    total = route.index.total
    average = None
    cutoff = _local_midnight(now)
    if first and cutoff - first.recorded_at >= MINIMUM_ESTIMATE_AGE:
        days = (cutoff - first.recorded_at) / timedelta(days=1)
        daily_distance = _daily_distance(route, fixes, cutoff, replay=replay)
        average = daily_distance / days
    return Progress(
        revision=route.revision,
        status=status,
        tracking_interval_minutes=tracking_interval_minutes
        if status in ("active", "awaiting")
        else None,
        position=position,
        first_recorded_at=first.recorded_at if first else None,
        latest_recorded_at=latest.recorded_at if latest else None,
        latest_retrieved_at=latest.retrieved_at if latest else None,
        average_metres_per_day=average,
        walking_metres_per_hour=_walking_metres_per_hour(accepted),
        current_walking_metres_per_hour=_current_walking_metres_per_hour(accepted, latest)
        if status in ("active", "awaiting")
        else None,
        completed=completed,
        remaining=total - completed,
        percentage=100 if completed == total else 100 * completed / total,
        backtracked=max(0.0, furthest - completed),
    )


@router.get("/{hike_id:uuid}/planned-map", response_model=PlannedMap)
def get_planned_map(hike_id: UUID, db: DatabaseSession) -> PlannedMap:
    return _planned(_route(db, hike_id))


@router.get(
    "/{hike_id:uuid}/route.gpx",
    response_class=Response,
    responses={200: {"content": {"application/gpx+xml": {}}}},
)
def download_route(hike_id: UUID, db: DatabaseSession) -> Response:
    route = _route(db, hike_id)
    gpx = Element(
        "gpx", version="1.1", creator="Knut vandrar", xmlns="http://www.topografix.com/GPX/1/1"
    )
    track = SubElement(gpx, "trk")
    for line in route.lines:
        segment = SubElement(track, "trkseg")
        for lon, lat, *elevation in line:
            point = SubElement(segment, "trkpt", lat=str(lat), lon=str(lon))
            if elevation:
                SubElement(point, "ele").text = str(elevation[0])
    return Response(
        tostring(gpx, encoding="utf-8", xml_declaration=True),
        media_type="application/gpx+xml",
        headers={"Content-Disposition": 'attachment; filename="hike-route.gpx"'},
    )


# The public surface has at most one live hike. Share its latest projection across
# visitors while recomputing staleness against the current time on every request.
_live_snapshot: tuple[tuple[object, ...], Progress] | None = None


def _live_progress(
    db: DatabaseSession,
    hike: Hike,
    sync: GarminSync,
    route: CompiledRoute,
    now: datetime,
    tracking_interval_minutes: int | None = None,
) -> Progress:
    global _live_snapshot
    start = hike.actual_start_at or hike.planned_start_at or sync.started_at
    key = (
        hike.id,
        route.revision,
        start,
        hike.actual_end_at,
        sync.succeeded_at,
        _local_midnight(now),
    )
    snapshot = _live_snapshot
    if snapshot and snapshot[0] == key:
        progress = snapshot[1]
    else:
        points = db.scalars(
            select(GarminPoint)
            .where(
                GarminPoint.hike_id == hike.id,
                GarminPoint.recorded_at >= start,
                GarminPoint.recorded_at <= min(now, utc(hike.actual_end_at or now)),
            )
            .order_by(GarminPoint.recorded_at, GarminPoint.source_id)
        )
        fixes = [
            Fix(
                p.source_id,
                utc(p.recorded_at),
                utc(p.retrieved_at),
                p.data,
            )
            for p in points
        ]
        progress = _progress(route, fixes, now)
        _live_snapshot = (key, progress)

    status = progress.status
    if sync.succeeded_at is None or sync.attempted_at > sync.succeeded_at:
        status = "unavailable"
    elif (
        status == "active"
        and progress.latest_recorded_at
        and now - progress.latest_recorded_at >= FRESH_FIX_WINDOW
    ):
        status = "awaiting"
    return progress.model_copy(
        update={
            "status": status,
            "current_walking_metres_per_hour": progress.current_walking_metres_per_hour
            if tracking_interval_minutes is not None
            else None,
            "tracking_interval_minutes": tracking_interval_minutes
            if progress.status in ("active", "awaiting")
            else None,
        }
    )


@router.get("/{hike_id:uuid}/tracking-progress", response_model=Progress)
def get_tracking_progress(
    hike_id: UUID,
    db: DatabaseSession,
    response: Response,
) -> Progress:
    response.headers["Cache-Control"] = "no-store"
    requested = db.get(Hike, hike_id)
    if requested is None or requested.status not in (HikeStatus.PLANNED, HikeStatus.ONGOING):
        raise HTTPException(404, "Live tracking unavailable")
    route = _route(db, hike_id)
    blank = Progress(
        revision=route.revision,
        remaining=route.index.total,
        status="notStarted",
        completed=0,
        percentage=0,
        backtracked=0,
    )
    if requested.status != HikeStatus.ONGOING:
        return blank
    hikes = ongoing_hikes(db)
    if len(hikes) != 1:
        return blank.model_copy(update={"status": "conflict"})
    hike = hikes[0]
    sync = db.get(GarminSync, hike_id)
    now = datetime.now(UTC)
    if sync is None:
        return blank.model_copy(update={"status": "unavailable"})
    config = db.get(GarminSettings, 1)
    if settings.garmin_feed_url and config and config.active and config.password:
        return _live_progress(db, hike, sync, route, now, config.tracking_interval_minutes)
    return _live_progress(db, hike, sync, route, now).model_copy(update={"status": "stopped"})


@lru_cache(maxsize=2)
def _replay_fixes(path: Path, modified: int) -> list[Fix]:
    with path.open("rb") as file:
        return parse_kml(file.read(MAX_KML_BYTES + 1))


@router.get(
    "/{hike_id:uuid}/tracking-replay",
    response_model=Replay,
)
def get_tracking_replay(
    hike_id: UUID,
    db: DatabaseSession,
    response: Response,
    at: AwareDatetime | None = None,
) -> Replay:
    response.headers["Cache-Control"] = "no-store"
    path = settings.garmin_replay_file
    if (
        settings.deployment_environment != "local"
        or path is None
        or hike_id != settings.garmin_replay_hike_id
    ):
        raise HTTPException(404, "Historical replay is unavailable")
    try:
        fixes = _replay_fixes(path, path.stat().st_mtime_ns)
    except (OSError, ValueError, ParseError) as exc:
        logger.warning("Garmin replay fixture could not be loaded (%s)", type(exc).__name__)
        raise HTTPException(503, "Historical replay data could not be loaded") from exc
    if not fixes:
        raise HTTPException(503, "Historical replay contains no tracking data")
    route = _route(db, hike_id)
    start = fixes[0].recorded_at - timedelta(minutes=1)
    end = fixes[-1].recorded_at
    config = db.get(GarminSettings, 1)
    interval = config.tracking_interval_minutes if config else DEFAULT_TRACKING_INTERVAL_MINUTES
    return Replay(
        route=_planned(route) if at is None else None,
        start=start,
        end=end,
        progress=_progress(
            route, fixes, at or start, replay=True, tracking_interval_minutes=interval
        ),
    )


class MapShareSettings(BaseModel):
    password: str = Field(max_length=256)
    active: bool
    tracking_interval_minutes: int = Field(
        default=DEFAULT_TRACKING_INTERVAL_MINUTES, strict=True, gt=0, le=2_147_483_647
    )

    @model_validator(mode="after")
    def require_active_password(self) -> "MapShareSettings":
        if self.active and not self.password.strip():
            raise ValueError("Active Garmin MapShare requires a password")
        return self


settings_router = APIRouter(
    prefix="/api/settings/mapshare",
    tags=["tracking"],
    dependencies=[Depends(require_admin_auth)],
)


@settings_router.get("", response_model=MapShareSettings, openapi_extra={"x-admin-only": True})
def get_mapshare_settings(db: DatabaseSession) -> MapShareSettings:
    config = db.get(GarminSettings, 1)
    return (
        MapShareSettings(
            password=config.password,
            active=config.active,
            tracking_interval_minutes=config.tracking_interval_minutes,
        )
        if config
        else MapShareSettings(password="", active=False)
    )


@settings_router.put("", response_model=MapShareSettings)
def put_mapshare_settings(body: MapShareSettings, db: DatabaseSession) -> MapShareSettings:
    values = body.model_dump(exclude_unset=True)
    saved = db.execute(
        insert(GarminSettings)
        .values(id=1, **values)
        .on_conflict_do_update(
            index_elements=[GarminSettings.id],
            set_=values,
        )
        .returning(GarminSettings.tracking_interval_minutes)
    ).scalar_one()
    db.commit()
    return body.model_copy(update={"tracking_interval_minutes": saved})
