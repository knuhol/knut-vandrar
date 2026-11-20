"""Geographic correctness and atomic map generation without provider requests."""

import hashlib
import json
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.maps import cli
from knut_vandrar_backend.maps.assets import images
from knut_vandrar_backend.maps.config import fingerprint, load_config
from knut_vandrar_backend.maps.geometry import route_data, segments
from knut_vandrar_backend.models.enums import RouteScope
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
from knut_vandrar_backend.tracks.gpx import store

GPX = b"""<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1"><trk>
<trkseg><trkpt lat="59" lon="15"/><trkpt lat="60" lon="16"/></trkseg>
<trkseg><trkpt lat="61" lon="17"/><trkpt lat="62" lon="18"/></trkseg></trk></gpx>"""


@pytest.fixture()
def route_environment(tmp_path: Path) -> Iterator[tuple[sessionmaker[Session], Path, UUID]]:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine)
    hike_id = uuid4()
    with factory.begin() as db:
        db.add(Hike(id=hike_id))
        db.flush()
        collection = TrackCollection(hike_id=hike_id, source_id="1", name="Example", details={})
        db.add(collection)
        db.flush()
        hike = db.get(Hike, hike_id)
        assert hike is not None
        hike.track_collection_id = collection.id
        db.add(
            TrackRoute(
                collection_id=collection.id,
                source_id="1",
                digest=store(tmp_path, GPX),
                details={"source_order": 0, "stage": "1"},
            )
        )
    yield factory, tmp_path, hike_id
    engine.dispose()


def test_segments_never_connect_separate_tracks() -> None:
    assert segments(GPX) == [[[15, 59], [16, 60]], [[17, 61], [18, 62]]]
    with pytest.raises(ValueError):
        segments(GPX.replace(b'lat="62"', b'lat="nan"'))
    with pytest.raises(ValueError, match="single-point"):
        segments(GPX.replace(b'<trkpt lat="62" lon="18"/>', b""))


def test_order_bounds_and_circular_detection(route_environment: Any) -> None:
    factory, root, hike_id = route_environment
    with factory.begin() as db:
        hike = db.get(Hike, hike_id)
        db.add(
            TrackRoute(
                collection_id=hike.track_collection_id,
                source_id="2",
                digest=store(root, GPX.replace(b'lat="62" lon="18"', b'lat="59" lon="15"')),
                details={"source_order": 1, "stage": "2"},
            )
        )
    with factory() as db:
        hike = db.get(Hike, hike_id)
        result = route_data(db, hike, root, 50)
        assert result["bounds"] == [[15, 59], [18, 62]]
        assert result["start"] == result["finish"] == [15, 59]
        assert result["circular"]
        assert [f["properties"]["sourceId"] for f in result["geojson"]["features"]] == ["1", "2"]
        assert len(result["geojson"]["features"][0]["geometry"]["coordinates"]) == 2


def test_trail_range_includes_lettered_stages_preserving_source_order(
    route_environment: Any,
) -> None:
    from knut_vandrar_backend.models.location import HikingLocation

    factory, root, hike_id = route_environment
    with factory.begin() as db:
        location = HikingLocation()
        db.add(location)
        db.flush()
        hike = db.get(Hike, hike_id)
        hike.location_id = location.id
        hike.start_stage, hike.end_stage = 3, 2
        hike.route_scope = RouteScope.TRAIL_SECTION
        collection = db.get(TrackCollection, hike.track_collection_id)
        collection.hike_id = None
        collection.location_id = location.id
        collection.direction = "backward"
        first = db.query(TrackRoute).one()
        first.details = {"source_order": 0, "stage": "4"}
        for order, label in enumerate(["3", "2B", "2A", "1"], 1):
            db.add(
                TrackRoute(
                    collection_id=collection.id,
                    source_id=str(order + 1),
                    details={"source_order": order, "stage": label},
                    digest=store(root, GPX),
                )
            )
    with factory() as db:
        result = route_data(db, db.get(Hike, hike_id), root, 50)
        assert [f["properties"]["stage"] for f in result["geojson"]["features"]] == [
            "3",
            "2B",
            "2A",
        ]


def test_incomplete_or_corrupt_route_fails(route_environment: Any) -> None:
    factory, root, hike_id = route_environment
    with factory.begin() as db:
        hike = db.get(Hike, hike_id)
        collection = db.get(TrackCollection, hike.track_collection_id)
        collection.details = {"incomplete": True}
    with factory() as db, pytest.raises(ValueError, match="incomplete"):
        route_data(db, db.get(Hike, hike_id), root, 50)
    with factory.begin() as db:
        collection = db.query(TrackCollection).one()
        collection.details = {}
    next(root.glob("tracks/*/*.gpx")).write_bytes(b"bad")
    with factory() as db, pytest.raises(ValueError, match="checksum"):
        route_data(db, db.get(Hike, hike_id), root, 50)


def test_antimeridian_bounds_are_narrow(route_environment: Any) -> None:
    factory, root, hike_id = route_environment
    with factory.begin() as db:
        route = db.query(TrackRoute).one()
        route.digest = store(
            root,
            GPX.replace(b'lon="15"', b'lon="179"')
            .replace(b'lon="16"', b'lon="-179"')
            .replace(b'lon="17"', b'lon="179.5"')
            .replace(b'lon="18"', b'lon="-179.5"'),
        )
    with factory() as db:
        data = route_data(db, db.get(Hike, hike_id), root, 50)
        assert data["bounds"][1][0] - data["bounds"][0][0] == 2


def test_generation_is_atomic_idempotent_and_detects_changes(
    route_environment: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory, root, hike_id = route_environment
    calls = []

    def render(command: list[str], **kwargs: Any) -> None:
        calls.append(command)
        job = json.loads(kwargs["input"])
        for name, size in job["config"]["variants"].items():
            Image.new("RGB", (size["width"], size["height"]), "white").save(
                Path(job["output"]) / f"{name}.png"
            )

    monkeypatch.setattr(cli.subprocess, "run", render)
    monkeypatch.setenv("MAPS_OPENFREEMAP_PERMISSION_CONFIRMED", "true")
    assert cli.generate(factory, root, hike_id, check=True) == "needs generation"
    assert not calls
    assert cli.generate(factory, root, hike_id) == "generated"
    assert cli.generate(factory, root, hike_id) == "up to date"
    assert len(calls) == 1
    assert cli.generate(factory, root, hike_id, check=True, labels="overview") == "needs generation"
    assert cli.generate(factory, root, hike_id, check=True, terrain="none") == "needs generation"
    cli.export_images(factory, hike_id, root / "review")
    assert len(list((root / "review" / str(hike_id)).glob("*.webp"))) == 4
    with factory() as db:
        old = {name: row.sha256 for name, row in images(db, hike_id).items()}
        assert set(old) == {"mobile", "tablet", "desktop", "wide"}
    assert cli.generate(factory, root, hike_id, force=True) == "generated"
    with factory.begin() as db:
        route = db.query(TrackRoute).one()
        route.digest = store(root, GPX.replace(b'lat="62"', b'lat="63"'))
    assert cli.generate(factory, root, hike_id, check=True) == "needs generation"

    def fail(*args: Any, **kwargs: Any) -> None:
        raise subprocess.CalledProcessError(1, "node")

    monkeypatch.setattr(cli.subprocess, "run", fail)
    with pytest.raises(subprocess.CalledProcessError):
        cli.generate(factory, root, hike_id)
    with factory() as db:
        assert {name: row.sha256 for name, row in images(db, hike_id).items()} == old


def test_provider_permission_gate_does_not_render(
    route_environment: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory, root, hike_id = route_environment
    monkeypatch.delenv("MAPS_OPENFREEMAP_PERMISSION_CONFIRMED", raising=False)
    with pytest.raises(ValueError, match="permission"):
        cli.generate(factory, root, hike_id)
    with factory() as db:
        assert images(db, hike_id) == {}


def test_render_configuration_and_fingerprints() -> None:
    config, style, tokens = load_config()
    assert config["variants"]["wide"] == {"width": 2880, "height": 1620}
    assert tokens["orange"] == "#f39200" and "paper" in tokens
    assert style["version"] == 8
    assert fingerprint({"a": 1, "b": 2}) == fingerprint({"b": 2, "a": 1})
    assert fingerprint({"a": 1}) != fingerprint({"a": 2})
    assert hashlib.sha256(b"test").hexdigest() != fingerprint({"a": 1})


def test_trail_itinerary_may_skip_official_stage_numbers(route_environment: Any) -> None:
    from knut_vandrar_backend.models.location import HikingLocation

    factory, root, hike_id = route_environment
    with factory.begin() as db:
        location = HikingLocation()
        db.add(location)
        db.flush()
        hike = db.get(Hike, hike_id)
        hike.location_id = location.id
        hike.start_stage, hike.end_stage = 27, 11
        collection = db.get(TrackCollection, hike.track_collection_id)
        collection.hike_id = None
        collection.location_id = location.id
        collection.direction = "backward"
        first = db.query(TrackRoute).one()
        first.details = {"source_order": 0, "stage": "27B"}
        for order, label in enumerate(["26", "23", "15", "11", "10"], 1):
            db.add(
                TrackRoute(
                    collection_id=collection.id,
                    source_id=str(order + 1),
                    details={"source_order": order, "stage": label},
                    digest=store(root, GPX),
                )
            )
    with factory() as db:
        result = route_data(db, db.get(Hike, hike_id), root, 50)
        assert [f["properties"]["stage"] for f in result["geojson"]["features"]] == [
            "27B",
            "26",
            "23",
            "15",
            "11",
        ]


def test_include_remaining_collection_preserves_later_stages(route_environment: Any) -> None:
    from knut_vandrar_backend.models.location import HikingLocation

    factory, root, hike_id = route_environment
    with factory.begin() as db:
        location = HikingLocation()
        db.add(location)
        db.flush()
        hike = db.get(Hike, hike_id)
        hike.location_id = location.id
        hike.start_stage, hike.end_stage = 27, 11
        collection = db.get(TrackCollection, hike.track_collection_id)
        collection.hike_id = None
        collection.location_id = location.id
        collection.direction = "backward"
        db.query(TrackRoute).one().details = {"source_order": 0, "stage": "27B"}
        for order, label in enumerate(["11", "10", "1A"], 1):
            db.add(
                TrackRoute(
                    collection_id=collection.id,
                    source_id=str(order + 1),
                    details={"source_order": order, "stage": label},
                    digest=store(root, GPX),
                )
            )
    with factory() as db:
        hike = db.get(Hike, hike_id)
        bounded = route_data(db, hike, root, 50)
        complete = route_data(db, hike, root, 50, include_remaining=True)
        assert [f["properties"]["stage"] for f in bounded["geojson"]["features"]] == ["27B", "11"]
        assert [f["properties"]["stage"] for f in complete["geojson"]["features"]] == [
            "27B",
            "11",
            "10",
            "1A",
        ]
        assert (hike.start_stage, hike.end_stage) == (27, 11)


def test_reversed_boundary_stages_use_outer_endpoints_and_names(route_environment: Any) -> None:
    factory, root, hike_id = route_environment

    def gpx(a: float, b: float) -> bytes:
        return (
            f'<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1"><trk><trkseg>'
            f'<trkpt lat="59" lon="{a}"/><trkpt lat="59" lon="{b}"/>'
            "</trkseg></trk></gpx>"
        ).encode()

    with factory.begin() as db:
        first = db.query(TrackRoute).one()
        first.digest = store(root, gpx(15, 14))
        first.details = {"source_order": 0, "start": "Join A", "end": "North"}
        for i, a, b, start, end in [
            (1, 16, 15, "Join B", "Join A"),
            (2, 17, 16, "South", "Join B"),
        ]:
            db.add(
                TrackRoute(
                    collection_id=first.collection_id,
                    source_id=str(i + 1),
                    digest=store(root, gpx(a, b)),
                    details={"source_order": i, "start": start, "end": end},
                )
            )
    with factory() as db:
        route = route_data(db, db.get(Hike, hike_id), root, 50)
        assert route["start"] == [14, 59]
        assert route["finish"] == [17, 59]
        assert route["labels"] == {"start": "North", "finish": "South"}
        assert route["geojson"]["features"][0]["geometry"]["coordinates"][0][0] == [15, 59]


def test_preview_preserves_database_and_tracks_presentation(
    route_environment: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory, root, hike_id = route_environment

    def render(command: list[str], **kwargs: Any) -> None:
        job = json.loads(kwargs["input"])
        assert job["illustration"]["profile"] == "overview"
        assert job["topography"]["mode"] == "hillshade"
        assert job["country"]["type"] == "Feature"
        for name, size in job["config"]["variants"].items():
            Image.new("RGB", (size["width"], size["height"])).save(
                Path(job["output"]) / f"{name}.png"
            )

    monkeypatch.setattr(cli.subprocess, "run", render)
    monkeypatch.setenv("MAPS_OPENFREEMAP_PERMISSION_CONFIRMED", "true")
    assert "preview generated" in cli.generate(
        factory,
        root,
        hike_id,
        labels="overview",
        terrain="hillshade",
        preview_output=root / "preview",
    )
    with factory() as db:
        assert images(db, hike_id) == {}
    assert len(list((root / "preview" / str(hike_id)).glob("*.webp"))) == 4
    data = json.loads((root / "preview" / str(hike_id) / "provenance.json").read_text())
    assert data["inputs"]["presentation"]["terrain"] == "hillshade"


def test_terrain_classification_is_in_render_inputs_and_freshness(
    route_environment: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from knut_vandrar_backend.models.enums import TrailType
    from knut_vandrar_backend.models.location import HikingLocation, LocationTerrain

    factory, root, hike_id = route_environment
    with factory.begin() as db:
        location = HikingLocation()
        db.add(location)
        db.flush()
        location_id = location.id
        db.get(Hike, hike_id).location_id = location_id
        db.add(LocationTerrain(location_id=location_id, terrain=TrailType.MOUNTAINS))

    def render(command: list[str], **kwargs: Any) -> None:
        job = json.loads(kwargs["input"])
        assert job["illustration"]["profile"] == "auto"
        assert job["illustration"]["terrainTypes"] == ["mountains"]
        for name, size in job["config"]["variants"].items():
            Image.new("RGB", (size["width"], size["height"])).save(
                Path(job["output"]) / f"{name}.png"
            )

    monkeypatch.setattr(cli.subprocess, "run", render)
    monkeypatch.setenv("MAPS_OPENFREEMAP_PERMISSION_CONFIRMED", "true")
    assert cli.generate(factory, root, hike_id) == "generated"
    assert cli.generate(factory, root, hike_id, check=True) == "up to date"
    with factory.begin() as db:
        db.delete(db.get(LocationTerrain, (location_id, TrailType.MOUNTAINS)))
        db.add(LocationTerrain(location_id=location_id, terrain=TrailType.LOWLANDS))
    assert cli.generate(factory, root, hike_id, check=True) == "needs generation"


def test_endpoints_follow_hike_stage_direction_without_reordering_gpx(
    route_environment: Any,
) -> None:
    from knut_vandrar_backend.models.enums import HikeStatus
    from knut_vandrar_backend.models.location import HikingLocation

    factory, root, hike_id = route_environment
    with factory.begin() as db:
        location = HikingLocation()
        db.add(location)
        db.flush()
        hike = db.get(Hike, hike_id)
        hike.location_id = location.id
        hike.status = HikeStatus.COMPLETED
        collection = db.get(TrackCollection, hike.track_collection_id)
        collection.hike_id = None
        collection.location_id = location.id
        collection.direction = "forward"
        first = db.query(TrackRoute).one()
        first.details = {"source_order": 0, "stage": "1", "start": "North", "end": "Join"}
        first.digest = store(
            root,
            GPX.replace(
                b'<trkseg><trkpt lat="61" lon="17"/><trkpt lat="62" lon="18"/></trkseg>', b""
            ),
        )
        db.add(
            TrackRoute(
                collection_id=collection.id,
                source_id="2",
                digest=store(
                    root,
                    GPX.replace(
                        b'<trkseg><trkpt lat="59" lon="15"/><trkpt lat="60" lon="16"/></trkseg>',
                        b"",
                    ).replace(b'lat="61" lon="17"', b'lat="60" lon="16"'),
                ),
                details={"source_order": 1, "stage": "2", "start": "Join", "end": "South"},
            )
        )
        hike.start_stage, hike.end_stage = 2, 1
    with factory() as db:
        hike = db.get(Hike, hike_id)
        reverse = route_data(db, hike, root, 50)
        assert reverse["labels"] == {"start": "South", "finish": "North"}
        assert reverse["completed"] is True
        hike.start_stage, hike.end_stage = 1, 2
        forward = route_data(db, hike, root, 50)
        assert forward["labels"] == {"start": "North", "finish": "South"}
        assert forward["start"] == reverse["finish"]
        assert forward["finish"] == reverse["start"]
        assert forward["geojson"] == reverse["geojson"]


def test_database_stop_controls_generation_and_freshness(
    route_environment: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from decimal import Decimal

    from knut_vandrar_backend.models.enums import HikeStatus

    factory, root, hike_id = route_environment
    with factory.begin() as db:
        hike = db.get(Hike, hike_id)
        hike.status = HikeStatus.ABORTED
        hike.stop_latitude, hike.stop_longitude = Decimal("59.5"), Decimal("15.5")
        hike.stop_stage = "1"

    def render(command: list[str], **kwargs: Any) -> None:
        job = json.loads(kwargs["input"])
        assert job["route"]["stop"]["recorded"] == [15.5, 59.5]
        assert job["route"]["completed"] is False
        assert {f["properties"]["progress"] for f in job["route"]["geojson"]["features"]} == {
            "walked",
            "remaining",
        }
        for name, size in job["config"]["variants"].items():
            Image.new("RGB", (size["width"], size["height"])).save(
                Path(job["output"]) / f"{name}.png"
            )

    monkeypatch.setattr(cli.subprocess, "run", render)
    monkeypatch.setenv("MAPS_OPENFREEMAP_PERMISSION_CONFIRMED", "true")
    assert cli.generate(factory, root, hike_id) == "generated"
    assert cli.generate(factory, root, hike_id, check=True) == "up to date"
    with factory.begin() as db:
        hike = db.get(Hike, hike_id)
        hike.stop_latitude, hike.stop_longitude = Decimal("59.6"), Decimal("15.6")
    assert cli.generate(factory, root, hike_id, check=True) == "needs generation"
