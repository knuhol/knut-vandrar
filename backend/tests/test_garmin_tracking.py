"""Garmin tracking parsing, projection, replay and public lifecycle behavior."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from email.message import Message
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from uuid import UUID, uuid4
from xml.etree.ElementTree import fromstring

import pytest
from fastapi.testclient import TestClient

from knut_vandrar_backend.api import tracking
from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
from knut_vandrar_backend.models.tracking import GarminPoint, GarminSettings, GarminSync
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.tracking.garmin import Fix, parse_kml, utc
from knut_vandrar_backend.tracking.match import Projection, Route, match
from knut_vandrar_backend.tracks.gpx import store
from tests.helpers import TEST_WRITE_TOKEN

START = datetime(2026, 9, 17, 10, 30, tzinfo=UTC)
FIRST_DAILY_UPDATE = 3 * 1440 + 11 * 60 + 30
GPX = b"""<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1"><trk>
<trkseg><trkpt lat="59" lon="15"><ele>102</ele></trkpt><trkpt lat="59" lon="15.04"/></trkseg>
<trkseg><trkpt lat="59" lon="15.05"/><trkpt lat="59" lon="15.06"/></trkseg></trk></gpx>"""


def _fix(minute: int, lon: float, event: str = "", lat: float = 59) -> Fix:
    at = START + timedelta(minutes=minute)
    return Fix(str(minute), at, at, {"coordinates": [lon, lat], "valid": True, "event": event})


def _kml(*fixes: Fix) -> bytes:
    placemarks = []
    for fix in fixes:
        lon, lat = fix.data["coordinates"]
        fields = {
            "Id": fix.source_id,
            "Time UTC": fix.recorded_at.strftime("%m/%d/%Y %I:%M:%S %p"),
            "Valid GPS Fix": "True",
            "Longitude": str(lon),
            "Latitude": str(lat),
            "Elevation": "102 m",
            "Velocity": "4.0 km/h",
            "Course": "90.00 ° True",
            "Event": fix.data["event"],
            "IMEI": "discard-me",
            "Text": "private test message",
        }
        data = "".join(f'<Data name="{k}"><value>{v}</value></Data>' for k, v in fields.items())
        placemarks.append(f"<Placemark><ExtendedData>{data}</ExtendedData></Placemark>")
    summary = (
        "<Placemark><LineString><coordinates>15,59 16,59</coordinates></LineString></Placemark>"
    )
    return (
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
        + "".join(placemarks)
        + summary
        + "</Document></kml>"
    ).encode()


def test_individual_points_are_sorted_deduplicated_and_validated() -> None:
    value = _kml(_fix(10, 15.01), _fix(0, 15), _fix(10, 15.01), _fix(20, 181))
    fixes = parse_kml(value, START)
    assert [fix.source_id for fix in fixes] == ["0", "10", "20"]
    assert fixes[0].recorded_at == fixes[0].retrieved_at == START
    assert fixes[1].data["velocity"] == 4
    assert fixes[1].data["course"] == 90
    assert fixes[2].data["coordinates"] is None
    assert fixes[2].data["recorded_coordinates"] == [181, 59]
    assert fixes[0].data["text"] == "private test message"
    assert "discard-me" not in str(fixes)
    with pytest.raises(ValueError, match="declarations"):
        parse_kml(b"<!DOCTYPE kml>" + value)


def test_projection_respects_continuity_route_gaps_and_backtracking() -> None:
    route = Route([[[15, 59], [15.04, 59]], [[15.05, 59], [15.06, 59]]], 15)
    fixes = [_fix(0, 15), _fix(15, 15.02), _fix(30, 15.01), _fix(40, 15.045, lat=59.01)]
    live, _ = match(route, fixes, backtracking=False)
    replay, furthest = match(route, fixes, backtracking=True)
    assert live and replay
    assert live.fix.source_id == "15"
    assert replay.fix.source_id == "30"
    assert furthest == pytest.approx(live.distance)
    assert live.offset < 1
    assert replay.coordinates == pytest.approx([15.01, 59])
    assert route.total == pytest.approx(live.distance * 2.5)


def test_crossing_does_not_jump_to_a_later_retraced_stage() -> None:
    route = Route(
        [[[15, 59], [15.015, 59], [15.015, 59.02], [15, 59.02], [15, 59], [15.015, 59]]], 15
    )
    projected, _ = match(route, [_fix(0, 15.006), _fix(3, 15.01)], backtracking=False)
    assert projected
    assert projected.edge.index == 0


def _seed(root: Path) -> UUID:
    with app.state.testing_session_local.begin() as db:
        hike = Hike(status=HikeStatus.PLANNED, planned_start_at=START)
        db.add(hike)
        db.flush()
        collection = TrackCollection(hike_id=hike.id, source_id="1", name="Test route")
        db.add(collection)
        db.flush()
        hike.track_collection_id = collection.id
        db.add(
            TrackRoute(
                collection_id=collection.id,
                source_id="1",
                digest=store(root, GPX),
                details={"source_order": 0},
            )
        )
        return UUID(str(hike.id))


def test_public_lifecycle_and_private_historical_replay(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from knut_vandrar_backend.tracking import routes

    hike_id = _seed(tmp_path)
    fixture = tmp_path / "history.kml"
    fixture.write_bytes(
        _kml(
            _fix(0, 15, "Tracking turned on from device."),
            _fix(15, 15.02),
            _fix(25, 15.02),
            _fix(30, 15.03, "Tracking turned off from device."),
            _fix(FIRST_DAILY_UPDATE + 45, 15.0598),
        )
    )
    monkeypatch.setattr(routes, "settings", replace(settings, media_root=tmp_path))
    monkeypatch.setattr(
        tracking,
        "settings",
        replace(
            settings,
            deployment_environment="local",
            garmin_replay_file=fixture,
            garmin_replay_hike_id=hike_id,
        ),
    )
    prefix = f"/api/hikes/{hike_id}"
    planned = client.get(f"{prefix}/planned-map").json()
    assert len(planned["lines"]) == 2
    assert planned["lines"][0][0] == [15, 59, 102]
    assert client.get(f"{prefix}/tracking-progress").json()["status"] == "notStarted"

    path = f"{prefix}/tracking-replay"
    local_settings = replace(
        settings,
        deployment_environment="local",
        garmin_mapshare_username="trail-owner",
        garmin_replay_file=fixture,
        garmin_replay_hike_id=hike_id,
    )
    monkeypatch.setattr(
        tracking, "settings", replace(local_settings, deployment_environment="prod")
    )
    assert client.get(path).status_code == 404
    monkeypatch.setattr(tracking, "settings", local_settings)
    assert client.get("/api/settings/mapshare", headers={"Authorization": ""}).status_code == 401
    assert (
        client.put(
            "/api/settings/mapshare", json={"password": "fixture", "active": True}
        ).status_code
        == 200
    )
    settings_path = "/api/settings/mapshare"
    credentials = {"password": "fixture", "active": True}
    assert client.get(settings_path).json() == {**credentials, "tracking_interval_minutes": 10}
    for invalid in (0, -1, 1.5, True):
        assert (
            client.put(
                settings_path, json={**credentials, "tracking_interval_minutes": invalid}
            ).status_code
            == 422
        )
    updated = {**credentials, "tracking_interval_minutes": 20}
    assert client.put(settings_path, json=updated).json() == updated
    assert client.put(settings_path, json=credentials).json() == updated
    assert client.get(settings_path).json() == updated
    assert client.get(path, headers={"Authorization": ""}).status_code == 200
    assert client.get(path).json()["progress"]["position"] is None

    def at(minute: int) -> dict[str, Any]:
        response = client.get(path, params={"at": (START + timedelta(minutes=minute)).isoformat()})
        assert response.status_code == 200
        assert "private test message" not in response.text
        result: dict[str, Any] = response.json()["progress"]
        return result

    early = at(10)
    later = at(31)
    assert datetime.fromisoformat(str(early["first_recorded_at"])) == START
    assert early["status"] == "active"
    assert early["tracking_interval_minutes"] == 20
    assert early["current_walking_metres_per_hour"] is None
    moving = at(15)
    assert moving["current_walking_metres_per_hour"] == pytest.approx(moving["completed"] * 4)
    assert at(25)["current_walking_metres_per_hour"] == 0
    assert later["status"] == "stopped"
    assert later["tracking_interval_minutes"] is None
    assert later["current_walking_metres_per_hour"] is None
    assert at(10) == early
    assert at(3 * 1440)["average_metres_per_day"] is None
    assert at(FIRST_DAILY_UPDATE - 1)["average_metres_per_day"] is None
    checkpoint = at(FIRST_DAILY_UPDATE)
    assert checkpoint["average_metres_per_day"] == pytest.approx(
        checkpoint["completed"] / (FIRST_DAILY_UPDATE / 1440)
    )
    finished = at(FIRST_DAILY_UPDATE + 45)
    assert finished["average_metres_per_day"] == checkpoint["average_metres_per_day"]
    next_midnight = FIRST_DAILY_UPDATE + 1440
    assert at(next_midnight)["average_metres_per_day"] == pytest.approx(
        planned["total"] / (next_midnight / 1440)
    )
    assert finished["position"]["coordinates"] == planned["finish"]
    assert finished["completed"] == planned["total"]
    assert finished["percentage"] == 100
    assert finished["remaining"] == 0

    with app.state.testing_session_local.begin() as db:
        hike = db.get(Hike, hike_id)
        assert hike
        hike.status = HikeStatus.ONGOING
        assert db.query(GarminPoint).count() == db.query(GarminSync).count() == 0
    assert client.get(f"{prefix}/tracking-progress").json()["status"] == "unavailable"
    with app.state.testing_session_local.begin() as db:
        db.add(
            GarminSync(hike_id=hike_id, started_at=START, attempted_at=START, succeeded_at=START)
        )
        for fix in (_fix(0, 15), _fix(10, 15.02)):
            db.add(
                GarminPoint(
                    hike_id=hike_id,
                    source_id=fix.source_id,
                    recorded_at=fix.recorded_at,
                    retrieved_at=START,
                    data=fix.data,
                )
            )
    live = client.get(f"{prefix}/tracking-progress").json()
    assert live["status"] == "awaiting"
    assert live["tracking_interval_minutes"] == 20
    assert live["current_walking_metres_per_hour"] == pytest.approx(live["completed"] * 6)
    assert live["position"]["coordinates"] == pytest.approx([15.02, 59])
    with app.state.testing_session_local.begin() as db:
        sync = db.get(GarminSync, hike_id)
        assert sync
        sync.attempted_at = START + timedelta(minutes=10)
    unavailable = client.get(f"{prefix}/tracking-progress").json()
    assert unavailable["status"] == "unavailable"
    assert unavailable["position"] == live["position"]
    assert unavailable["tracking_interval_minutes"] == 20
    assert client.put(settings_path, json={**credentials, "active": False}).status_code == 200
    stopped = client.get(f"{prefix}/tracking-progress").json()
    assert stopped["status"] == "stopped"
    assert stopped["tracking_interval_minutes"] is None
    assert stopped["current_walking_metres_per_hour"] is None
    assert stopped["latest_recorded_at"] == live["latest_recorded_at"]

    with app.state.testing_session_local.begin() as db:
        db.add(Hike(id=uuid4(), status=HikeStatus.ONGOING))
    assert client.get(f"{prefix}/tracking-progress").json()["status"] == "conflict"

    with app.state.testing_session_local.begin() as db:
        hike = db.get(Hike, hike_id)
        assert hike
        hike.status = HikeStatus.COMPLETED
    assert client.get(f"{prefix}/planned-map", headers={"Authorization": ""}).json() == planned
    download = client.get(f"{prefix}/route.gpx", headers={"Authorization": ""})
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/gpx+xml"
    assert download.headers["content-disposition"].startswith("attachment")
    segments = fromstring(download.content).findall("./{*}trk/{*}trkseg")
    assert len(segments) == len(planned["lines"])
    for segment, line in zip(segments, planned["lines"], strict=True):
        assert [[float(point.attrib["lon"]), float(point.attrib["lat"])] for point in segment] == [
            point[:2] for point in line
        ]
    assert client.get(f"{prefix}/tracking-progress").status_code == 404
    with app.state.testing_session_local.begin() as db:
        hike = db.get(Hike, hike_id)
        assert hike
        hike.status = HikeStatus.ABORTED
        hike.stop_latitude = Decimal("59")
        hike.stop_longitude = Decimal("15.02")
    aborted = client.get(f"{prefix}/planned-map").json()
    assert aborted["stop"]["coordinates"] == pytest.approx([15.02, 59])
    assert aborted["stop"]["line"] == aborted["stop"]["edge"] == 0
    assert (
        client.get(path, headers={"Authorization": f"Bearer {TEST_WRITE_TOKEN}"}).status_code == 200
    )


def test_worker_backfills_and_retries_rate_limited_windows(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from sqlite3 import Connection

    from sqlalchemy import create_engine, event, select
    from sqlalchemy.orm import sessionmaker

    from knut_vandrar_backend.database.base import Base
    from knut_vandrar_backend.tracking import worker

    engine = create_engine(f"sqlite:///{tmp_path / 'poll.db'}")

    @event.listens_for(engine, "connect")
    def register_lock(connection: Connection, record: object) -> None:
        connection.create_function("pg_try_advisory_xact_lock", 1, lambda _: True)

    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    monkeypatch.setattr(
        worker, "settings", replace(settings, garmin_mapshare_username="trail-owner")
    )
    with factory.begin() as db:
        db.add(GarminSettings(id=1, password="fixture", active=True))
        hike = Hike(status=HikeStatus.ONGOING, actual_start_at=START)
        db.add(hike)
        db.flush()
        collection = TrackCollection(hike_id=hike.id, source_id="1", name="Example")
        db.add(collection)
        db.flush()
        hike.track_collection_id = collection.id
        hike_id = hike.id

    now = START + timedelta(days=2)

    class Clock:
        @classmethod
        def now(cls, tz: object = None) -> datetime:
            return now

    windows: list[tuple[datetime, datetime]] = []

    def fetch(feed_url: str, password: str, since: datetime, end: datetime) -> list[Fix]:
        assert feed_url == "https://share.garmin.com/feed/share/trail-owner"
        assert password == "fixture"
        windows.append((since, end))
        if len(windows) == 3:
            raise HTTPError(feed_url, 429, "Too Many Requests", Message(), None)
        return (
            [_fix(30, 15.02), _fix(10, 15.01), _fix(-30, 15)]
            if len(windows) > 1
            else [_fix(30, 15.02)]
        )

    monkeypatch.setattr(worker, "datetime", Clock)
    monkeypatch.setattr(worker, "fetch_fixes", fetch)
    try:
        worker.poll()
        worker.poll()
        assert windows == [(START, now)]
        now += timedelta(minutes=2)
        worker.poll()
        assert windows[-1] == (START, now)
        with factory.begin() as db:
            points = list(db.scalars(select(GarminPoint).order_by(GarminPoint.recorded_at)))
            assert [point.source_id for point in points] == ["10", "30"]
            assert all(point.hike_id == hike_id for point in points)
        last_success = now
        now += timedelta(minutes=2)
        worker.poll()
        with factory.begin() as db:
            sync = db.get(GarminSync, hike_id)
            assert sync
            assert sync.covered_until is not None
            assert utc(sync.covered_until) == last_success
            assert sync.retry_after is not None
            assert utc(sync.retry_after) == now + timedelta(hours=1)
        now += timedelta(minutes=59)
        worker.poll()
        assert len(windows) == 3
        now += timedelta(minutes=1)
        worker.poll()
        assert windows[-1] == (last_success - timedelta(days=2), now)
        with factory.begin() as db:
            sync = db.get(GarminSync, hike_id)
            assert sync
            assert sync.retry_after is None
            assert sync.covered_until is not None
            assert utc(sync.covered_until) == now
            assert db.query(GarminPoint).count() == 2
            db.add(Hike(status=HikeStatus.ONGOING))
        now += timedelta(minutes=2)
        worker.poll()
        assert len(windows) == 4
    finally:
        engine.dispose()


def test_tracking_midnight_follows_stockholm_daylight_saving() -> None:
    assert tracking._local_midnight(datetime(2026, 10, 25, 0, 30, tzinfo=UTC)) == datetime(
        2026, 10, 24, 22, tzinfo=UTC
    )
    assert tracking._local_midnight(datetime(2026, 10, 25, 23, 30, tzinfo=UTC)) == datetime(
        2026, 10, 25, 23, tzinfo=UTC
    )


def test_walking_pace_uses_forward_movement_between_overnight_stops() -> None:
    route = Route([[[15, 59], [15.2, 59]]], 15)
    fixes = [
        _fix(0, 15),
        _fix(10, 15.015),
        _fix(20, 15.03),
        _fix(20 + 16 * 60, 15.03),
        _fix(30 + 16 * 60, 15.045),
        _fix(40 + 16 * 60, 15.045),
    ]
    accepted: list[Projection] = []
    match(route, fixes, backtracking=False, accepted=accepted)
    assert tracking._walking_metres_per_hour(accepted[:3]) is None
    assert tracking._walking_metres_per_hour(accepted) == pytest.approx(5150, abs=50)
