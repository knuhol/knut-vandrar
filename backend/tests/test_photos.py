"""Photo delivery, upload limits, metadata, and image normalization."""

from io import BytesIO
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from knut_vandrar_backend.main import app
from knut_vandrar_backend.models.translation import TranslationJob
from tests.helpers import _planned_payload, _png_image


def test_gallery_upload_delivery_order_and_private_original(client: TestClient) -> None:
    from knut_vandrar_backend.api.photos import photo_directory

    hike = client.post("/api/hikes", json=_planned_payload()).json()
    content = _png_image((3000, 1500))
    uploaded = client.post(f"/api/hikes/{hike['id']}/photos", content=content)
    assert uploaded.status_code == 201, uploaded.text
    photo = uploaded.json()
    assert (photo["width"], photo["height"]) == (2560, 1280)
    for key, size in (("thumbnail_url", (640, 320)), ("image_url", (2560, 1280))):
        response = client.get(photo[key])
        assert response.headers["content-type"] == "image/webp"
        assert "immutable" in response.headers["cache-control"]
        with Image.open(BytesIO(response.content)) as image:
            assert image.size == size
            assert not image.getexif()
    original = f"/api/photos/{photo['id']}/original"
    assert client.get(original).content == content
    token = client.headers.pop("Authorization")
    assert client.get(original).status_code == 401
    assert client.get(photo["thumbnail_url"]).status_code == 200
    assert client.post(f"/api/hikes/{hike['id']}/photos", content=content).status_code == 401
    client.headers["Authorization"] = token
    other = client.post(f"/api/hikes/{hike['id']}/photos", content=content).json()
    order_url = f"/api/hikes/{hike['id']}/photos/order"
    assert client.put(order_url, json={"ids": [other["id"], photo["id"]]}).status_code == 204
    assert client.put(order_url, json={"ids": [photo["id"], photo["id"]]}).status_code == 422
    page = client.get(f"/api/hikes/{hike['id']}/photos?limit=1").json()
    assert page["total"] == 2 and page["items"][0]["id"] == other["id"]
    assert (
        client.get(f"/api/hikes/{hike['id']}/photos?limit=1&offset=1").json()["items"][0]["id"]
        == photo["id"]
    )
    assert client.delete(f"/api/photos/{photo['id']}").status_code == 204
    assert not photo_directory(UUID(photo["id"])).exists()
    assert client.get(photo["image_url"]).status_code == 404
    assert client.delete(f"/api/hikes/{hike['id']}").status_code == 204
    assert not photo_directory(UUID(other["id"])).exists()


def test_gallery_rejects_invalid_oversized_and_cross_hike_order(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    path = f"/api/hikes/{hike['id']}/photos"
    assert client.post(path, content=b"not an image").status_code == 415
    assert (
        client.post(path, content=b'<svg xmlns="http://www.w3.org/2000/svg"/>').status_code == 415
    )
    assert (
        client.post(path, content=b"x", headers={"Content-Length": "25000001"}).status_code == 413
    )
    photo = client.post(path, content=_png_image((20, 20))).json()
    other = client.post(
        "/api/hikes",
        json=_planned_payload(english={"title": "Another hike", "summary_markdown": "Summary"}),
    ).json()
    assert (
        client.put(
            f"/api/hikes/{other['id']}/photos/order", json={"ids": [photo["id"]]}
        ).status_code
        == 422
    )


def test_gallery_accepts_heic_and_respects_orientation(client: TestClient) -> None:
    from pillow_heif import register_heif_opener

    register_heif_opener()
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    image = Image.new("RGB", (80, 40), "green")
    output = BytesIO()
    image.save(output, format="HEIF")
    response = client.post(f"/api/hikes/{hike['id']}/photos", content=output.getvalue())
    assert response.status_code == 201, response.text
    assert response.json()["width"] == 80
    assert client.get(f"/api/photos/{response.json()['id']}/original").content == output.getvalue()
    output = BytesIO()
    exif = Image.Exif()
    exif[274] = 6
    image.save(output, format="JPEG", exif=exif)
    response = client.post(f"/api/hikes/{hike['id']}/photos", content=output.getvalue())
    assert response.status_code == 201, response.text
    assert (response.json()["width"], response.json()["height"]) == (40, 80)


def test_gallery_checks_stream_size_without_content_length() -> None:
    import asyncio

    from fastapi import HTTPException
    from starlette.requests import Request as StarletteRequest

    from knut_vandrar_backend.api.image_uploads import read_image_body

    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"12345", "more_body": False}

    request = StarletteRequest({"type": "http", "headers": []}, receive)
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_image_body(request, max_bytes=4))
    assert error.value.status_code == 413


def test_gallery_rejects_over_40_megapixels(client: TestClient) -> None:
    import struct
    import zlib

    hike = client.post("/api/hikes", json=_planned_payload()).json()
    image = bytearray(_png_image((1, 1)))
    image[16:24] = struct.pack(">II", 10000, 5000)
    image[29:33] = struct.pack(">I", zlib.crc32(image[12:29]))
    response = client.post(f"/api/hikes/{hike['id']}/photos", content=bytes(image))
    assert response.status_code == 413


@pytest.mark.parametrize(
    "size", [6_000_000, 25_000_000], ids=["six-megabyte-image", "exactly-25-megabyte-limit"]
)
def test_cover_image_accepts_up_to_25_mb(client: TestClient, size: int) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    image = _png_image((20, 20))
    # Valid PNG with trailing padding exercises the byte limit without huge dimensions.
    response = client.put(
        f"/api/hikes/{hike['id']}/cover-image",
        content=image + bytes(size - len(image)),
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 200, response.text
    assert client.get(response.json()["cover_image_url"]).headers["content-type"] == "image/webp"


def test_cover_image_rejects_over_25_mb(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    response = client.put(
        f"/api/hikes/{hike['id']}/cover-image",
        content=b"x",
        headers={"Content-Length": "25000001"},
    )
    assert response.status_code == 413


@pytest.mark.parametrize("destination", ["cover", "gallery"])
def test_multi_picture_jpeg_uses_primary_still(client: TestClient, destination: str) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    output = BytesIO()
    Image.new("RGB", (80, 60), "green").save(
        output,
        format="MPO",
        save_all=True,
        append_images=[Image.new("L", (40, 30), 128)],
    )
    content = output.getvalue()
    with Image.open(BytesIO(content)) as source:
        assert source.format == "MPO" and getattr(source, "is_animated", False)
    if destination == "cover":
        response = client.put(f"/api/hikes/{hike['id']}/cover-image", content=content)
        assert response.status_code == 200, response.text
        image_url = response.json()["cover_image_url"]
    else:
        response = client.post(f"/api/hikes/{hike['id']}/photos", content=content)
        assert response.status_code == 201, response.text
        image_url = response.json()["image_url"]
        original = client.get(f"/api/photos/{response.json()['id']}/original")
        assert original.headers["content-type"] == "image/jpeg"
        assert original.content == content
    with Image.open(BytesIO(client.get(image_url).content)) as optimized:
        assert optimized.size == (80, 60)
        pixel = optimized.getpixel((40, 30))
        assert isinstance(pixel, tuple)
        assert pixel[1] > pixel[0] + 50  # Primary green image, not grayscale auxiliary.
        assert not getattr(optimized, "is_animated", False)


@pytest.mark.parametrize("format_name", ["GIF", "PNG", "WEBP"])
def test_animated_uploads_are_still_rejected(client: TestClient, format_name: str) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    output = BytesIO()
    Image.new("RGB", (20, 20), "green").save(
        output,
        format=format_name,
        save_all=True,
        append_images=[Image.new("RGB", (20, 20), "red")],
        duration=100,
        loop=0,
    )
    for path, method in (
        (f"/api/hikes/{hike['id']}/photos", "POST"),
        (f"/api/hikes/{hike['id']}/cover-image", "PUT"),
    ):
        response = client.request(method, path, content=output.getvalue())
        assert response.status_code == 415
        assert response.json()["detail"] == "Please upload a static image"


def test_photo_manual_edit_preserves_other_text_and_never_queues(client: TestClient) -> None:
    hike = client.post("/api/hikes", json=_planned_payload()).json()
    photo = client.post(f"/api/hikes/{hike['id']}/photos", content=_png_image((20, 20))).json()
    path = f"/api/photos/{photo['id']}"
    client.put(path, json={"english": {"alt": "Forest", "caption": "First night"}})
    translation_path = path + "/translations/sv"
    client.put(translation_path, json={"alt": "Skog", "caption": "Första natten"})
    saved = client.put(translation_path, json={"alt": "Skog", "caption": "Andra natten"})
    assert saved.status_code == 200
    assert saved.json()["alt"] == "Skog"
    assert saved.json()["caption"] == "Andra natten"
    assert saved.json()["translation"]["review_status"] == "manual"
    assert client.get(path).json()["caption"] == "First night"
    assert client.get(path + "?locale=cs").json()["translation"]["locale"] == "en"
    with app.state.testing_session_local() as db:
        assert not db.scalars(select(TranslationJob)).all()
