"""Hike and location API behavior, ordering, and validation."""

import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import cast
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import event
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api.hikes import _duration_days
from knut_vandrar_backend.main import app
from knut_vandrar_backend.media.covers import backfill_desktop_covers
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike, HikeCoverAsset, HikeCoverImage, HikeTranslation
from knut_vandrar_backend.models.reference import InfoCardType
from tests.helpers import _db_session, _get_jobs, _planned_payload, _png_image


@pytest.mark.parametrize("locale", ["en", "sv", "cs"])
def test_hikes_are_ordered_by_start_date_before_pagination(client: TestClient, locale: str) -> None:
    earlier = datetime(2026, 5, 1, tzinfo=UTC)
    later = datetime(2026, 6, 1, tzinfo=UTC)
    db = _db_session(client)
    for index, (planned, actual) in enumerate(
        [(later, earlier), (earlier, later), (later, None), (earlier, None), (None, None)],
        start=1,
    ):
        hike = Hike(id=UUID(int=index), planned_start_at=planned, actual_start_at=actual)
        db.add(hike)
        db.flush()
        db.add(
            HikeTranslation(
                hike_id=hike.id,
                locale_code=locale,
                title=f"Hike {index}",
                summary_markdown="Summary",
                slug=f"hike-{index}",
                created_at=earlier + timedelta(days=index),
            )
        )
    db.commit()
    db.close()

    response = client.get("/api/hikes", params={"locale": locale})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [
        str(UUID(int=index)) for index in [2, 3, 1, 4, 5]
    ]

    page = client.get("/api/hikes", params={"locale": locale, "limit": 2, "offset": 1})
    assert page.status_code == 200
    assert page.json()["total"] == 5
    assert [item["id"] for item in page.json()["items"]] == [
        str(UUID(int=index)) for index in [3, 1]
    ]


def test_changing_a_title_keeps_the_old_localized_slug_as_redirect(client: TestClient) -> None:
    response = client.post("/api/hikes", json=_planned_payload())
    hike_id = response.json()["id"]
    previous_slug = response.json()["translation"]["slug"]

    updated = client.put(
        f"/api/hikes/{hike_id}",
        json=_planned_payload(
            english={
                "title": "A new title for the hike",
                "tagline": "A few days outside",
                "summary_markdown": "A short summary reused on both pages.",
                "description_markdown": "## The plan\n\nFollow the trail.",
            },
        ),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["translation"]["slug"] == "a-new-title-for-the-hike"

    redirect = client.get(f"/api/hikes/en/{previous_slug}", follow_redirects=False)
    assert redirect.status_code == 308
    assert redirect.headers["location"] == "/api/hikes/en/a-new-title-for-the-hike"


def test_trail_supports_multiple_countries_and_enum_type(client: TestClient) -> None:
    response = client.post(
        "/api/locations",
        json={
            "english": {"name": "The Border Trail"},
            "terrains": ["lowlands"],
            "country_codes": ["se", "no"],
            "official_url": "https://example.com/trail",
        },
    )
    assert response.status_code == 201
    assert response.json()["terrains"] == ["lowlands"]
    assert response.json()["country_codes"] == ["NO", "SE"]


def test_trail_logo_is_stored_and_served_from_backend(client: TestClient) -> None:
    trail = client.post(
        "/api/locations",
        json={"english": {"name": "Test Trail"}, "terrains": ["lowlands"], "country_codes": ["se"]},
    ).json()
    assert trail["logo_url"] is None

    logo_bytes = _png_image((1024, 512))
    uploaded = client.put(
        f"/api/locations/{trail['id']}/logo",
        content=logo_bytes,
        headers={"Content-Type": "application/octet-stream"},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["logo_url"].endswith(f"/api/locations/{trail['id']}/logo")

    served = client.get(uploaded.json()["logo_url"])
    assert served.status_code == 200
    with Image.open(BytesIO(served.content)) as image:
        assert image.size == (512, 256)
        assert image.getpixel((0, 0)) == (20, 100, 180)
    assert served.headers["content-type"] == "image/webp"
    assert served.headers["x-content-type-options"] == "nosniff"
    cached = client.get(
        uploaded.json()["logo_url"], headers={"If-None-Match": served.headers["etag"]}
    )
    assert cached.status_code == 304

    deleted = client.delete(f"/api/locations/{trail['id']}/logo")
    assert deleted.status_code == 204
    assert client.get(f"/api/locations/{trail['id']}/logo").status_code == 404


def test_trail_logo_upload_rejects_unsupported_content(client: TestClient) -> None:
    trail = client.post(
        "/api/locations",
        json={"english": {"name": "Test Trail"}, "terrains": ["lowlands"], "country_codes": ["se"]},
    ).json()
    response = client.put(
        f"/api/locations/{trail['id']}/logo",
        content=b"not an image",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 415


def test_trail_logo_upload_rejects_oversized_body(client: TestClient) -> None:
    trail = client.post(
        "/api/locations",
        json={"english": {"name": "Test Trail"}, "terrains": ["lowlands"], "country_codes": ["se"]},
    ).json()
    response = client.put(
        f"/api/locations/{trail['id']}/logo",
        content=b"x" * (5 * 1024 * 1024 + 1),
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 413


def test_hike_endpoints_video_and_cover_image_round_trip(client: TestClient) -> None:
    payload = _planned_payload(
        start_point="Stenkälle gården",
        end_point="Kloten",
        cards=[{"type": "youtube_video", "url": "https://youtu.be/dQw4w9WgXcQ"}],
    )
    response = client.post("/api/hikes", json=payload)
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["start_point"] == "Stenkälle gården"
    assert hike["end_point"] == "Kloten"
    assert hike["cover_image_url"] is None
    assert hike["cards"] == [{"type": "youtube_video", "url": "https://youtu.be/dQw4w9WgXcQ"}]

    image_bytes = _png_image((4200, 2100))
    uploaded = client.put(
        f"/api/hikes/{hike['id']}/cover-image",
        content=image_bytes,
        headers={"Content-Type": "application/octet-stream"},
    )
    assert uploaded.status_code == 200, uploaded.text
    image_url = uploaded.json()["cover_image_url"]
    sources = uploaded.json()["cover_sources"]
    assert image_url.endswith(f"/api/hikes/{hike['id']}/cover-image")
    served = client.get(image_url)
    assert served.status_code == 200
    with Image.open(BytesIO(served.content)) as image:
        assert image.size == (3840, 1920)
        assert image.format == "WEBP"
    assert served.headers["content-type"] == "image/webp"
    assert served.headers["cache-control"] == "public, max-age=0, must-revalidate"
    versioned = client.get(sources["full"])
    assert versioned.content == served.content
    assert versioned.headers["cache-control"] == "public, max-age=31536000, immutable"
    stale = client.get(image_url, params={"v": "old"}, follow_redirects=False)
    assert stale.status_code == 307
    assert stale.headers["cache-control"] == "no-store"
    assert client.get(stale.headers["location"]).content == served.content
    for variant, size in [("desktop", (2560, 1280)), ("mobile", (1600, 800)), ("card", (960, 480))]:
        derivative = client.get(image_url, params={"variant": variant})
        assert derivative.status_code == 200
        assert derivative.headers["etag"] != served.headers["etag"]
        cached = client.get(sources[variant])
        assert cached.content == derivative.content
        assert cached.headers["cache-control"] == "public, max-age=31536000, immutable"
        with Image.open(BytesIO(derivative.content)) as image:
            assert image.size == size
    wide = client.get(sources["wide"])
    assert wide.headers["content-type"] == "image/avif"
    assert wide.headers["cache-control"] == "public, max-age=31536000, immutable"
    with Image.open(BytesIO(wide.content)) as image:
        assert image.size == (3840, 1920)
    assert client.get(image_url, params={"variant": "original"}).status_code == 422
    with _db_session(client) as db:
        original = db.get(HikeCoverAsset, (UUID(hike["id"]), "original"))
        assert original is not None
        assert original.content == image_bytes

    listed = client.get("/api/hikes?locale=en")
    assert listed.json()["items"][0]["cover_image_url"] == image_url
    assert listed.json()["items"][0]["cover_sources"] == sources

    deleted = client.delete(f"/api/hikes/{hike['id']}/cover-image")
    assert deleted.status_code == 204
    assert client.get(image_url).status_code == 404
    with _db_session(client) as db:
        assert db.get(HikeCoverAsset, (UUID(hike["id"]), "original")) is None


@pytest.mark.parametrize("variant", [None, "card", "mobile", "desktop"])
def test_cover_revalidation_does_not_load_image_bytes(
    client: TestClient, variant: str | None
) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    url = f"/api/hikes/{hike['id']}/cover-image"
    assert client.put(url, content=_png_image((40, 20))).status_code == 200
    params = {"variant": variant} if variant else {}
    served = client.get(url, params=params)
    statements: list[str] = []
    with _db_session(client) as db:
        engine = db.get_bind()

    def record_sql(*args: object) -> None:
        statements.append(str(args[2]))

    event.listen(engine, "before_cursor_execute", record_sql)
    try:
        response = client.get(url, params=params, headers={"If-None-Match": served.headers["etag"]})
    finally:
        event.remove(engine, "before_cursor_execute", record_sql)
    assert response.status_code == 304
    assert response.content == b""
    assert statements
    assert not any(re.search(r"\.content\b", statement) for statement in statements)


def test_backfill_desktop_cover_keeps_the_existing_master_and_is_idempotent(
    client: TestClient,
) -> None:
    hike_id = UUID(client.post("/api/hikes", json=_planned_payload()).json()["id"])
    cover_url = f"/api/hikes/{hike_id}/cover-image"
    assert client.put(cover_url, content=_png_image((2700, 1350))).status_code == 200
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    with factory.begin() as db:
        cover = db.get(HikeCoverImage, hike_id)
        assert cover is not None
        desktop_digest = cover.assets["desktop"].sha256
        wide_digest = cover.assets["wide"].sha256
        master_digest = cover.sha256
        original_digest = cover.assets["original"].sha256
        del cover.assets["desktop"]
        del cover.assets["wide"]

    assert backfill_desktop_covers(factory) == 1
    assert backfill_desktop_covers(factory) == 0
    with factory() as db:
        cover = db.get(HikeCoverImage, hike_id)
        assert cover is not None
        assert cover.sha256 == master_digest
        assert cover.assets["original"].sha256 == original_digest
        assert cover.assets["desktop"].sha256 == desktop_digest
        assert cover.assets["wide"].sha256 == wide_digest


def test_replacing_raster_cover_with_svg_removes_old_variants(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    url = f"/api/hikes/{hike['id']}/cover-image"
    assert client.put(url, content=_png_image((40, 20))).status_code == 200
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"/>'
    assert client.put(url, content=svg).status_code == 200
    for variant in ("card", "mobile", "desktop", "wide"):
        response = client.get(url, params={"variant": variant})
        assert response.content == svg
        assert response.headers["content-type"] == "image/svg+xml"
    with _db_session(client) as db:
        cover = db.get(HikeCoverImage, UUID(hike["id"]))
        assert cover is not None
        assert set(cover.assets) == {"original"}
        assert cover.assets["original"].content == svg


def test_legacy_cover_serves_the_stored_image_for_variant_requests(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    with _db_session(client) as db:
        db.add(
            HikeCoverImage(
                hike_id=UUID(hike["id"]),
                content=_png_image((400, 200)),
                content_type="image/png",
                sha256="a" * 64,
            )
        )
        db.commit()

    url = f"/api/hikes/{hike['id']}/cover-image"
    assert client.get(url, params={"variant": "card"}).content == client.get(url).content


def test_youtube_card_rejects_non_youtube_url(client: TestClient) -> None:
    payload = _planned_payload(
        cards=[{"type": "youtube_video", "url": "https://example.com/video"}]
    )
    assert client.post("/api/hikes", json=payload).status_code == 422


def test_card_schema_rejects_unknown_or_extra_config(client: TestClient) -> None:
    payload = _planned_payload(
        cards=[{"type": "route", "url": "https://example.com", "secret": "x"}]
    )
    assert client.post("/api/hikes", json=payload).status_code == 422


def test_duration_uses_actual_timestamps_and_rounds_up() -> None:
    hike = Hike(
        status=HikeStatus.COMPLETED,
        actual_start_at=datetime(2026, 1, 1, tzinfo=UTC),
        actual_end_at=datetime(2026, 1, 15, 1, tzinfo=UTC),
    )
    assert _duration_days(hike) == 15


def test_location_details_regions_ratings_and_validation(client: TestClient) -> None:
    region = client.post("/api/regions", json={"english": {"name": "Lapland"}})
    assert region.status_code == 201, region.text
    payload = {
        "kind": "area",
        "english": {"name": "Sarek", "season_note": "First note\nSecond note"},
        "country_codes": ["se"],
        "terrains": ["mountains", "coastal"],
        "region_ids": [region.json()["id"]],
        "hiking_months": [7, 8, 9],
        "water_sources_status": "known",
        "water_sources": ["natural"],
        "overnight_options_status": "known",
        "overnight_options": ["tent"],
        "overnight_restrictions_status": "known",
        "overnight_restrictions": [],
        "ratings": {"facilities": 0, "maintenance": -1, "difficulty": 7},
        "boat_connection_required": True,
    }
    response = client.post("/api/locations", json=payload)
    assert response.status_code == 201, response.text
    location = response.json()
    assert location["regions"][0]["name"] == "Lapland"
    assert location["ratings"]["difficulty"] == 7
    assert location["boat_connection_required"] is True
    assert location["ratings"]["maintenance"] == -1
    assert location["ratings"]["resupplies"] is None
    assert location["season_note"] == "First note\nSecond note"
    assert location["translation"]["locale"] == "en"
    assert client.get(f"/api/locations/{location['id']}?locale=sv").json()["name"] == "Sarek"
    assert client.delete(f"/api/regions/{region.json()['id']}").status_code == 409
    changes_to_check: list[dict[str, object]] = [
        {"hiking_months": [0]},
        {"hiking_months": []},
        {"is_loop": False},
        {"water_sources_status": "unknown"},
        {"country_codes": ["SE", "se"]},
        {"ratings": {"difficulty": 11}},
        {"ratings": {"maintenance": -2}},
    ]
    for changes in changes_to_check:
        assert client.post("/api/locations", json={**payload, **changes}).status_code == 422


def test_hike_journey_ratings_overnights_and_manual_achievement(client: TestClient) -> None:
    payload = _planned_payload(
        distance_km=105.25,
        start_latitude=68.358,
        start_longitude=18.783,
        direction="southbound",
        route_scope="trail_section",
        start_stage=17,
        end_stage=1,
        overnights_recorded_at=datetime.now(UTC).isoformat(),
        overnights=[{"accommodation_type": "tent", "night_count": 10}],
    )
    response = client.post("/api/hikes", json=payload)
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["distance_km"] == 105.25
    assert hike["start_latitude"] == 68.358
    assert hike["start_stage"] == 17
    assert hike["overnights"][0]["night_count"] == 10
    changes_to_check: list[dict[str, object]] = [
        {"end_latitude": 1},
        {"start_stage": 0},
        {"end_longitude": 181},
        {"overnights_recorded_at": None},
    ]
    for changes in changes_to_check:
        assert client.post("/api/hikes", json={**payload, **changes}).status_code == 422
    achievement = client.post(
        "/api/achievements",
        json={
            "hike_id": hike["id"],
            "icon": "trophy",
            "sort_order": 2,
            "english": {"title": "My own milestone", "description": "Entirely manual"},
        },
    )
    assert achievement.status_code == 201, achievement.text
    detail = client.get(f"/api/hikes/{hike['id']}").json()
    assert detail["achievements"][0]["title"] == "My own milestone"
    assert "thruHike" not in detail


def test_backpack_achievement_round_trip(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    response = client.post(
        "/api/achievements",
        json={
            "hike_id": hike["id"],
            "icon": "backpack",
            "english": {"title": "First hike without resupply"},
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["icon"] == "backpack"
    detail = client.get(f"/api/hikes/{hike['id']}").json()
    assert detail["achievements"][0]["icon"] == "backpack"
    assert (
        client.get("/openapi.json")
        .json()["components"]["schemas"]["AchievementIcon"]["enum"]
        .count("backpack")
        == 1
    )


@pytest.mark.parametrize("direction", ["clockwise", "counterclockwise"])
def test_circular_directions_round_trip(client: TestClient, direction: str) -> None:
    response = client.post("/api/hikes", json=_planned_payload(direction=direction))
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["direction"] == direction
    assert client.get(f"/api/hikes/{hike['id']}").json()["direction"] == direction
    alternate = "counterclockwise" if direction == "clockwise" else "clockwise"
    updated = client.put(f"/api/hikes/{hike['id']}", json=_planned_payload(direction=alternate))
    assert updated.status_code == 200, updated.text
    assert updated.json()["direction"] == alternate


def test_discovery_has_no_urls_when_content_is_empty(client: TestClient) -> None:
    assert client.get("/api/discovery/hikes").json() == {
        "items": [],
        "total": 0,
        "limit": 100,
        "offset": 0,
    }


def test_gpx_collection_card_round_trip(client: TestClient) -> None:
    cards = [{"type": "gpx_collection", "url": "https://www.plotaroute.com/routecollection/18991"}]
    response = client.post("/api/hikes", json=_planned_payload(cards=cards))
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["cards"] == cards
    fetched = client.get(f"/api/hikes/{hike['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["cards"] == cards


def test_card_display_order_follows_card_type_order(client: TestClient) -> None:
    route = {"type": "route", "url": "https://example.com/route"}
    gpx = {"type": "gpx_collection", "url": "https://www.plotaroute.com/routecollection/18991"}
    video = {"type": "youtube_video", "url": "https://youtu.be/abcdefghijk"}
    response = client.post("/api/hikes", json=_planned_payload(cards=[gpx, route, video]))
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["cards"] == [route, video, gpx]

    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    with factory.begin() as db:
        card_type = db.get(InfoCardType, "gpx_collection")
        assert card_type is not None
        card_type.sort_order_active = 0

    fetched = client.get(f"/api/hikes/{hike['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["cards"] == [gpx, route, video]

    # Saving the same array must preserve the configured card-type priority.
    saved = client.put(
        f"/api/hikes/{hike['id']}",
        json=_planned_payload(cards=[route, video, gpx]),
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["cards"] == [gpx, route, video]


@pytest.mark.parametrize(
    ("hike_status", "expected_types"),
    [
        ("planned", ["gpx_collection", "route", "youtube_video"]),
        ("ongoing", ["gpx_collection", "route", "youtube_video"]),
        ("completed", ["route", "youtube_video", "gpx_collection"]),
        ("aborted", ["route", "youtube_video", "gpx_collection"]),
    ],
    ids=[
        "planned-active-order",
        "ongoing-active-order",
        "completed-finished-order",
        "aborted-finished-order",
    ],
)
def test_card_order_uses_hike_status_for_every_detail_response(
    client: TestClient, hike_status: str, expected_types: list[str]
) -> None:
    route = {"type": "route", "url": "https://example.com/route"}
    video = {"type": "youtube_video", "url": "https://youtu.be/abcdefghijk"}
    gpx = {"type": "gpx_collection", "url": "https://www.plotaroute.com/routecollection/18991"}
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    with factory.begin() as db:
        route_type = db.get(InfoCardType, "route")
        gpx_type = db.get(InfoCardType, "gpx_collection")
        assert route_type is not None and gpx_type is not None
        route_type.sort_order_active = 10
        route_type.sort_order_finished = 0
        gpx_type.sort_order_active = 0
        gpx_type.sort_order_finished = 10
        video_type = db.get(InfoCardType, "youtube_video")
        assert video_type is not None
        video_type.sort_order_active = 20
        video_type.sort_order_finished = 5

    payload = _planned_payload(
        status=hike_status,
        actual_start_at=None if hike_status == "planned" else "2026-05-01T09:00:00Z",
        actual_end_at="2026-05-05T09:00:00Z" if hike_status in {"completed", "aborted"} else None,
        cards=[route, gpx, video],
    )
    created = client.post("/api/hikes", json=payload)
    assert created.status_code == 201, created.text
    hike = created.json()
    expected = [gpx, route, video] if expected_types[0] == "gpx_collection" else [route, video, gpx]
    assert hike["cards"] == expected
    assert client.get(f"/api/hikes/{hike['id']}").json()["cards"] == expected
    assert client.get(f"/api/hikes/en/{hike['translation']['slug']}").json()["cards"] == expected

    # Changing status switches order without changing either configured priority.
    next_status = "ongoing" if hike_status in {"completed", "aborted"} else "completed"
    payload.update(
        status=next_status,
        actual_start_at="2026-05-01T09:00:00Z",
        actual_end_at="2026-05-05T09:00:00Z" if next_status == "completed" else None,
    )
    saved = client.put(f"/api/hikes/{hike['id']}", json=payload)
    assert saved.status_code == 200, saved.text
    next_expected = [route, video, gpx] if next_status == "completed" else [gpx, route, video]
    assert saved.json()["cards"] == next_expected
    assert client.get(f"/api/hikes/{hike['id']}").json()["cards"] == next_expected


def test_hike_geographic_label_is_optional_and_localized(client: TestClient) -> None:
    payload = _planned_payload()
    created = client.post("/api/hikes", json=payload)
    assert created.status_code == 201
    assert created.json()["translation"]["geographic_label"] is None
    hike_url = f"/api/hikes/{created.json()['id']}"

    source = cast(dict[str, object], payload["english"])
    updated = client.put(
        hike_url,
        json={
            **payload,
            "english": {**source, "geographic_label": "  Sörmland · Southeastern Sweden  "},
        },
    )
    assert updated.status_code == 200
    assert updated.json()["translation"]["geographic_label"] == "Sörmland · Southeastern Sweden"
    assert client.put(hike_url, json=payload).json()["translation"]["geographic_label"] == (
        "Sörmland · Southeastern Sweden"
    )

    swedish = {
        "title": "Vandring i Sörmland",
        "summary_markdown": "En längre vandring.",
        "geographic_label": "Sörmland · Sydöstra Sverige",
    }
    translated = client.put(f"{hike_url}/translations/sv", json=swedish)
    assert translated.status_code == 200
    public_url = f"/api/hikes/sv/{translated.json()['slug']}"
    assert client.get(public_url).json()["translation"]["geographic_label"] == (
        "Sörmland · Sydöstra Sverige"
    )

    cleared = client.put(f"{hike_url}/translations/sv", json={**swedish, "geographic_label": " "})
    assert cleared.status_code == 200
    assert client.get(public_url).json()["translation"]["geographic_label"] is None
    assert _get_jobs(client) == []


def test_hike_selects_only_its_own_or_current_trail_collection(client: TestClient) -> None:
    from knut_vandrar_backend.models.location import HikingLocation, LocationTranslation
    from knut_vandrar_backend.models.track import TrackCollection

    trail, other_trail = UUID(int=8001), UUID(int=8002)
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    with factory.begin() as db:
        db.add_all([HikingLocation(id=trail), HikingLocation(id=other_trail)])
        db.flush()
        db.add_all(
            [
                LocationTranslation(location_id=value, locale_code="en", name=str(value))
                for value in (trail, other_trail)
            ]
        )
    first = client.post("/api/hikes", json=_planned_payload(location_id=str(trail))).json()
    second = client.post("/api/hikes", json=_planned_payload()).json()
    ids = [UUID(int=8100 + index) for index in range(4)]
    with factory.begin() as db:
        for identifier, location, hike in (
            (ids[0], trail, None),
            (ids[1], other_trail, None),
            (ids[2], None, UUID(first["id"])),
            (ids[3], None, UUID(second["id"])),
        ):
            db.add(
                TrackCollection(
                    id=identifier,
                    location_id=location,
                    hike_id=hike,
                    source_id="20512",
                    name=str(identifier),
                    direction="forward" if location else None,
                )
            )
    for identifier in (ids[0], ids[2]):
        result = client.put(
            f"/api/hikes/{first['id']}",
            json=_planned_payload(location_id=str(trail), track_collection_id=str(identifier)),
        )
        assert result.status_code == 200, result.text
        assert result.json()["track_collection_id"] == str(identifier)
    for identifier in (ids[1], ids[3], UUID(int=99999)):
        result = client.put(
            f"/api/hikes/{first['id']}",
            json=_planned_payload(location_id=str(trail), track_collection_id=str(identifier)),
        )
        assert result.status_code == 422, result.text
    # A custom collection remains usable when the hike has no trail.
    result = client.put(
        f"/api/hikes/{first['id']}",
        json=_planned_payload(location_id=None, track_collection_id=str(ids[2])),
    )
    assert result.status_code == 200, result.text
    # A trail collection becomes invalid when the hike changes trails.
    result = client.put(
        f"/api/hikes/{first['id']}",
        json=_planned_payload(location_id=str(other_trail), track_collection_id=str(ids[0])),
    )
    assert result.status_code == 422
    result = client.post(
        "/api/hikes", json=_planned_payload(location_id=str(trail), track_collection_id=str(ids[0]))
    )
    assert result.status_code == 201, result.text
    assert result.json()["track_collection_id"] == str(ids[0])
    result = client.put(
        f"/api/hikes/{first['id']}", json=_planned_payload(track_collection_id=None)
    )
    assert result.status_code == 200 and result.json()["track_collection_id"] is None


def test_collection_choices_are_scoped_paginated_and_private(client: TestClient) -> None:
    from knut_vandrar_backend.models.location import HikingLocation, LocationTranslation
    from knut_vandrar_backend.models.track import TrackCollection

    trail = UUID(int=8201)
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    with factory.begin() as db:
        db.add(HikingLocation(id=trail))
        db.flush()
        db.add(LocationTranslation(location_id=trail, locale_code="en", name="Trail"))
    first = client.post("/api/hikes", json=_planned_payload(location_id=str(trail))).json()
    second = client.post("/api/hikes", json=_planned_payload()).json()
    with factory.begin() as db:
        db.add_all(
            [
                TrackCollection(
                    id=UUID(int=8301),
                    location_id=trail,
                    source_id="1",
                    name="Trail",
                    direction="forward",
                ),
                TrackCollection(
                    id=UUID(int=8302),
                    hike_id=UUID(first["id"]),
                    source_id="1",
                    name="Custom",
                    direction=None,
                ),
                TrackCollection(
                    id=UUID(int=8303),
                    hike_id=UUID(second["id"]),
                    source_id="1",
                    name="Other",
                    direction=None,
                ),
            ]
        )
    query = {"location_id": str(trail), "hike_id": first["id"], "limit": 1}
    response = client.get("/api/track-collections", params=query)
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 2 and len(response.json()["items"]) == 1
    other = client.get("/api/track-collections", params={**query, "offset": 1}).json()
    assert {response.json()["items"][0]["name"], other["items"][0]["name"]} == {"Custom", "Trail"}
    assert client.get("/api/track-collections").json()["total"] == 0
    assert (
        client.get("/api/track-collections", params={"hike_id": first["id"]}).json()["total"] == 1
    )
    client.headers.pop("Authorization")
    assert client.get("/api/track-collections", params=query).status_code == 401


def test_stopping_point_round_trip_clear_and_validation(client: TestClient) -> None:
    payload = _planned_payload(stop_latitude=59.84081, stop_longitude=15.96310, stop_stage="11")
    response = client.post("/api/hikes", json=payload)
    assert response.status_code == 201, response.text
    hike = response.json()
    assert hike["stop_latitude"] == 59.84081
    assert hike["stop_longitude"] == 15.96310
    assert hike["stop_stage"] == "11"
    assert client.get(f"/api/hikes/{hike['id']}").json()["stop_stage"] == "11"
    for changes in (
        {"stop_longitude": None},
        {"stop_latitude": 91},
        {"stop_longitude": -181},
        {"stop_stage": "garbage"},
        {"stop_latitude": None, "stop_longitude": None},
    ):
        invalid = client.put(f"/api/hikes/{hike['id']}", json={**payload, **changes})
        assert invalid.status_code == 422, invalid.text
    cleared = client.put(f"/api/hikes/{hike['id']}", json=_planned_payload())
    assert cleared.status_code == 200, cleared.text
    assert all(
        cleared.json()[key] is None for key in ("stop_latitude", "stop_longitude", "stop_stage")
    )


@pytest.mark.parametrize("field", ["boat_connection_required", "is_national_park"])
@pytest.mark.parametrize("kind", ["trail", "area"])
@pytest.mark.parametrize("required", [True, False, None], ids=["enabled", "disabled", "unknown"])
def test_location_optional_flags_round_trip(
    client: TestClient, field: str, kind: str, required: bool | None
) -> None:
    payload = {
        "kind": kind,
        "english": {"name": "Optional location flags"},
        "country_codes": ["SE"],
        field: required,
    }
    response = client.post("/api/locations", json=payload)
    assert response.status_code == 201, response.text
    location = response.json()
    assert location[field] is required
    assert client.get(f"/api/locations/{location['id']}").json()[field] is required
    payload[field] = not required
    updated = client.put(f"/api/locations/{location['id']}", json=payload)
    assert updated.status_code == 200, updated.text
    assert updated.json()[field] is (not required)


def test_named_route_details_round_trip(client: TestClient) -> None:
    payload = _planned_payload(
        route_scope="named_hiking_route",
        named_route_name="Treparksmötet",
        named_route_url="https://example.com/treparksmotet",
    )
    response = client.post("/api/hikes", json=payload)
    assert response.status_code == 201, response.text
    hike_id = response.json()["id"]
    saved = client.get(f"/api/hikes/{hike_id}").json()
    assert saved["route_scope"] == "named_hiking_route"
    assert saved["named_route_name"] == "Treparksmötet"
    assert saved["named_route_url"] == "https://example.com/treparksmotet"
    for invalid in ["javascript:alert(1)", "not-a-url", "ftp://example.com/route"]:
        rejected = client.put(f"/api/hikes/{hike_id}", json={**payload, "named_route_url": invalid})
        assert rejected.status_code == 422
    updated = client.put(
        f"/api/hikes/{hike_id}",
        json={**payload, "named_route_name": "Another route", "named_route_url": None},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["named_route_name"] == "Another route"
    assert updated.json()["named_route_url"] is None


def test_paid_shelter_location_options_and_hike_overnights(client: TestClient) -> None:
    location = client.post(
        "/api/locations",
        json={
            "kind": "area",
            "english": {"name": "Paid shelters"},
            "country_codes": ["SE"],
            "overnight_options_status": "known",
            "overnight_options": ["paid_shelter_or_hut"],
        },
    )
    assert location.status_code == 201, location.text
    assert location.json()["overnight_options"] == ["paid_shelter_or_hut"]
    hike = client.post(
        "/api/hikes",
        json=_planned_payload(
            location_id=location.json()["id"],
            overnights_recorded_at="2026-11-20T12:00:00Z",
            overnights=[{"accommodation_type": "paid_shelter_or_hut", "night_count": 2}],
        ),
    )
    assert hike.status_code == 201, hike.text
    saved = client.get(f"/api/hikes/{hike.json()['id']}").json()
    assert saved["overnights"] == [{"accommodation_type": "paid_shelter_or_hut", "night_count": 2}]
    assert saved["location"]["overnight_options"] == ["paid_shelter_or_hut"]


@pytest.mark.parametrize("is_loop", [True, False, None], ids=["loop", "point-to-point", "unknown"])
def test_hike_loop_independent_of_location(client: TestClient, is_loop: bool | None) -> None:
    location = client.post(
        "/api/locations",
        json={"kind": "area", "country_codes": ["SE"], "english": {"name": "Muddus"}},
    ).json()
    response = client.post(
        "/api/hikes", json=_planned_payload(location_id=location["id"], is_loop=is_loop)
    )
    assert response.status_code == 201, response.text
    hike = client.get(f"/api/hikes/{response.json()['id']}").json()
    assert hike["is_loop"] is is_loop
    assert hike["location"]["is_loop"] is None
    updated = client.put(
        f"/api/hikes/{hike['id']}",
        json=_planned_payload(location_id=location["id"], is_loop=not is_loop),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["is_loop"] is (not is_loop)


def test_hike_category_boundaries_and_independent_pagination(client: TestClient) -> None:
    start = datetime(2026, 5, 1, 9, tzinfo=UTC)
    cases = [
        (100, timedelta(days=2), "long_distance"),
        (99, timedelta(days=4), "multi_day"),
        (20, timedelta(days=4, seconds=1), "long_distance"),
        (None, timedelta(days=5), "long_distance"),
        (None, timedelta(days=2), "multi_day"),
    ]
    categories: dict[str, set[str]] = {"long_distance": set(), "multi_day": set()}
    for distance, duration, category in cases:
        response = client.post(
            "/api/hikes",
            json=_planned_payload(
                distance_km=distance,
                planned_start_at=start.isoformat(),
                planned_end_at=(start + duration).isoformat(),
            ),
        )
        assert response.status_code == 201, response.text
        categories[category].add(response.json()["id"])
    # Include unknown duration/distance and ensure the categories are exhaustive.
    ongoing = client.post(
        "/api/hikes",
        json=_planned_payload(status="ongoing", actual_start_at=datetime.now(UTC).isoformat()),
    ).json()
    categories["multi_day"].add(ongoing["id"])
    for category, expected in categories.items():
        result = client.get("/api/hikes", params={"category": category, "limit": 2}).json()
        assert result["total"] == len(expected)
        assert len(result["items"]) == 2
        second = client.get(
            "/api/hikes", params={"category": category, "limit": 2, "offset": 2}
        ).json()
        assert second["total"] == len(expected)
        assert {item["id"] for item in result["items"] + second["items"]} == expected
    assert client.get("/api/hikes").json()["total"] == sum(map(len, categories.values()))
    assert client.get("/api/hikes?category=invalid").status_code == 422


@pytest.mark.parametrize("status", ["completed", "aborted", "ongoing"])
def test_category_uses_actual_dates_for_started_hikes(client: TestClient, status: str) -> None:
    end = datetime.now(UTC)
    response = client.post(
        "/api/hikes",
        json=_planned_payload(
            status=status,
            planned_start_at=(end - timedelta(days=2)).isoformat(),
            planned_end_at=end.isoformat(),
            actual_start_at=(end - timedelta(days=5)).isoformat(),
            actual_end_at=None if status == "ongoing" else end.isoformat(),
        ),
    )
    assert response.status_code == 201, response.text
    result = client.get("/api/hikes?category=long_distance").json()
    assert result["total"] == 1
    assert result["items"][0]["id"] == response.json()["id"]


def test_achievement_listing_uses_hike_order_before_pagination(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    created = []
    for order in [9, 1]:
        response = client.post(
            "/api/achievements",
            json={
                "hike_id": hike["id"],
                "icon": "tent",
                "sort_order": order,
                "english": {"title": f"Order {order}"},
            },
        )
        assert response.status_code == 201, response.text
        created.append(response.json())
    first = client.get("/api/achievements", params={"hike_id": hike["id"], "limit": 1}).json()
    second = client.get(
        "/api/achievements", params={"hike_id": hike["id"], "limit": 1, "offset": 1}
    ).json()
    assert first["total"] == second["total"] == 2
    assert first["items"][0]["id"] == created[1]["id"]
    assert second["items"][0]["id"] == created[0]["id"]


def test_hike_create_does_not_queue_translations_and_returns_typed_cards(
    client: TestClient,
) -> None:
    response = client.post("/api/hikes", json=_planned_payload())
    assert response.status_code == 201
    hike = response.json()
    assert hike["duration_days"] == 14
    assert hike["translation"]["slug"] == "hike-through-the-highlands"
    assert hike["cards"] == [{"type": "route", "url": "https://example.com/route.gpx"}]
    assert _get_jobs(client) == []


def test_discovery_is_public_bounded_and_uses_only_existing_translations(
    client: TestClient,
) -> None:
    first = client.post("/api/hikes", json=_planned_payload()).json()
    second = client.post("/api/hikes", json=_planned_payload()).json()
    content = _planned_payload()["english"]
    assert isinstance(content, dict)
    translated = {**content, "title": "Min första vandring"}
    assert (
        client.put(f"/api/hikes/{first['id']}/translations/sv", json=translated).status_code == 200
    )
    client.headers.pop("Authorization")

    response = client.get("/api/discovery/hikes", params={"limit": 1})
    assert response.status_code == 200
    assert response.headers["x-robots-tag"] == "noindex"
    page = response.json()
    assert page["total"] == 2
    assert len(page["items"]) == 1
    following = client.get("/api/discovery/hikes", params={"limit": 1, "offset": 1}).json()
    items = {item["id"]: item for item in page["items"] + following["items"]}
    assert set(items) == {first["id"], second["id"]}
    assert {item["locale"] for item in items[first["id"]]["translations"]} == {"en", "sv"}
    assert {item["locale"] for item in items[second["id"]]["translations"]} == {"en"}
    assert set(items[first["id"]]) == {"id", "translations"}
    detail = client.get(f"/api/hikes/{first['id']}").json()
    assert detail["available_translations"] == items[first["id"]]["translations"]
    assert client.get("/api/discovery/hikes", params={"offset": 2}).json()["items"] == []
    for query in [{"limit": 0}, {"limit": 101}, {"offset": -1}]:
        assert client.get("/api/discovery/hikes", params=query).status_code == 422


@pytest.mark.parametrize("locale", ["en", "sv"])
def test_hike_neighbors_follow_localized_listing_order_without_wrapping(
    client: TestClient, locale: str
) -> None:
    earlier = datetime(2026, 5, 1, tzinfo=UTC)
    later = datetime(2026, 6, 1, tzinfo=UTC)
    with _db_session(client) as db:
        for index, (planned, actual) in enumerate(
            [
                (later, earlier),
                (earlier, later),
                (later, None),
                (earlier, None),
                (None, None),
                (None, None),
            ],
            start=1,
        ):
            hike = Hike(id=UUID(int=index), planned_start_at=planned, actual_start_at=actual)
            db.add(hike)
            db.flush()
            for language in ["en", "sv"]:
                if language == "sv" and index == 3:
                    continue
                db.add(
                    HikeTranslation(
                        hike_id=hike.id,
                        locale_code=language,
                        title=f"{language} hike {index}",
                        summary_markdown="Summary",
                        slug=f"{language}-hike-{index}",
                    )
                )
        db.commit()
    ordered = [2, 3, 1, 4, 5, 6] if locale == "en" else [2, 1, 4, 5, 6]
    for position, index in enumerate(ordered):
        response = client.get(f"/api/hikes/{UUID(int=index)}/neighbors/{locale}")
        assert response.status_code == 200
        data = response.json()
        for name, offset in [("previous", -1), ("next", 1)]:
            neighbor_position = position + offset
            if 0 <= neighbor_position < len(ordered):
                neighbor_id = ordered[neighbor_position]
                assert data[name] == {
                    "id": str(UUID(int=neighbor_id)),
                    "title": f"{locale} hike {neighbor_id}",
                    "slug": f"{locale}-hike-{neighbor_id}",
                }
            else:
                assert data[name] is None
    assert client.get(f"/api/hikes/{UUID(int=999)}/neighbors/{locale}").status_code == 404
    if locale == "sv":
        assert client.get(f"/api/hikes/{UUID(int=3)}/neighbors/sv").status_code == 404


@pytest.mark.parametrize("card_type", ["route", "youtube_video", "gpx_collection"])
def test_duplicate_card_types_are_rejected_without_changing_saved_cards(
    client: TestClient, card_type: str
) -> None:
    urls = {
        "route": "https://example.com/route",
        "youtube_video": "https://youtu.be/abcdefghijk",
        "gpx_collection": "https://www.plotaroute.com/routecollection/18991",
    }
    card: dict[str, str] = {"type": card_type, "url": urls[card_type]}
    duplicate = {**card, "url": urls[card_type] + "?second=true"}
    invalid = _planned_payload(cards=[card, duplicate])
    created = client.post("/api/hikes", json=invalid)
    assert created.status_code == 422
    assert any(
        error["loc"] == ["body", "cards"] and card_type in error["msg"]
        for error in created.json()["detail"]
    )
    assert client.get("/api/hikes").json()["total"] == 0

    valid = client.post("/api/hikes", json=_planned_payload(cards=[card]))
    assert valid.status_code == 201, valid.text
    hike = valid.json()
    updated = client.put(f"/api/hikes/{hike['id']}", json=invalid)
    assert updated.status_code == 422
    assert client.get(f"/api/hikes/{hike['id']}").json()["cards"] == hike["cards"]


def test_database_rejects_duplicate_types_only_within_the_same_hike(client: TestClient) -> None:
    from sqlalchemy.exc import IntegrityError

    from knut_vandrar_backend.models.hike import HikeInfoCard

    first = client.post("/api/hikes", json=_planned_payload()).json()
    second = client.post("/api/hikes", json=_planned_payload()).json()
    assert first["id"] != second["id"]
    factory = cast(sessionmaker[Session], app.state.testing_session_local)
    with factory() as db, pytest.raises(IntegrityError), db.begin():
        db.add(
            HikeInfoCard(
                hike_id=UUID(first["id"]),
                type="route",
                data={"type": "route", "url": "https://example.com/another-route"},
            )
        )
        db.flush()


@pytest.mark.parametrize("state", ["active", "inactive"])
def test_visible_tracking_card_uses_site_password_without_map_progress(
    client: TestClient,
    state: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from knut_vandrar_backend.api import hikes
    from knut_vandrar_backend.settings import settings

    monkeypatch.setattr(
        hikes, "settings", replace(settings, garmin_mapshare_username="trail-owner")
    )
    assert (
        client.put(
            "/api/settings/mapshare", json={"password": "trail", "active": state == "active"}
        ).status_code
        == 200
    )
    created = client.post("/api/hikes", json=_planned_payload())
    assert created.status_code == 201, created.text
    hike = client.get(f"/api/hikes/{created.json()['id']}").json()
    assert hike["live_tracking"] == {"type": "live_position", "state": state}
    assert all(card["type"] != "live_position" for card in hike["cards"])
    assert hike["mapshare_url"] == (
        "https://share.garmin.com/trail-owner" if state == "active" else None
    )
    assert hike["mapshare_password"] == ("trail" if state == "active" else None)


def test_ongoing_hike_link_requires_exactly_one_ongoing_hike(client: TestClient) -> None:
    path = "/api/hikes/ongoing?locale=en"
    assert client.get(path).json() is None
    first = client.post(
        "/api/hikes",
        json=_planned_payload(status="ongoing", actual_start_at="2026-09-17T08:00:00Z"),
    )
    assert first.status_code == 201, first.text
    assert client.get(path).json() == {
        "id": first.json()["id"],
        "locale": "en",
        "slug": first.json()["translation"]["slug"],
    }
    second = client.post(
        "/api/hikes",
        json=_planned_payload(status="ongoing", actual_start_at="2026-09-18T08:00:00Z"),
    )
    assert second.status_code == 201, second.text
    assert client.get(path).json() is None
