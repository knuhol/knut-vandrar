"""Shared request handling for small image uploads and delivery."""

import warnings
import xml.etree.ElementTree as ElementTree
from io import BytesIO
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, Response, status

MAX_IMAGE_BYTES = 5 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


async def read_image_body(request: Request) -> bytes:
    """Read an image request body while enforcing the size limit during streaming."""
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_size = int(content_length)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Invalid Content-Length") from error
        if declared_size > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image must be 5 MiB or smaller")
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image must be 5 MiB or smaller")
        chunks.append(chunk)
    return b"".join(chunks)


ImageBody = Annotated[bytes, Depends(read_image_body)]
IMAGE_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "description": "Image bytes",
        "content": {
            media_type: {}
            for media_type in (
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
                "image/svg+xml",
            )
        },
    }
}


def detect_image_type(content: bytes) -> str:
    """Return a supported image media type based on content rather than client headers."""
    if content.startswith(PNG_SIGNATURE):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    normalized = content.lstrip().lower()
    if b"<!doctype" in normalized or b"<!entity" in normalized:
        raise HTTPException(
            status_code=415, detail="SVG document types and entities are not allowed"
        )
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as error:
        raise HTTPException(
            status_code=415, detail="Unsupported or invalid image content"
        ) from error
    if root.tag in {"{http://www.w3.org/2000/svg}svg", "svg"}:
        return "image/svg+xml"
    raise HTTPException(
        status_code=415, detail="Supported image types are PNG, JPEG, GIF, WebP, and SVG"
    )


def optimize_image(
    content: bytes, *, max_dimension: int, lossless: bool = False
) -> tuple[bytes, str]:
    """Normalize raster uploads for delivery; retain scalable SVG documents."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    media_type = detect_image_type(content)
    if media_type == "image/svg+xml":
        return content, media_type
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.width * source.height > 40_000_000:
                    raise HTTPException(
                        status_code=413, detail="Image must be 40 megapixels or smaller"
                    )
                if getattr(source, "is_animated", False):
                    raise HTTPException(status_code=415, detail="Please upload a static image")
                image = ImageOps.exif_transpose(source)
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                image = image.convert(
                    "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
                )
                image.info.clear()
                output = BytesIO()
                image.save(output, format="WEBP", quality=82, method=6, lossless=lossless)
                return output.getvalue(), "image/webp"
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=415, detail="Invalid or corrupt image") from error
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise HTTPException(status_code=413, detail="Image dimensions are too large") from error


def image_response(content: bytes, content_type: str, sha256: str, request: Request) -> Response:
    """Serve an image with revalidation and protections for SVG documents."""
    etag = f'"{sha256}"'
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
    }
    if content_type == "image/svg+xml":
        headers["Content-Security-Policy"] = (
            "default-src 'none'; style-src 'unsafe-inline'; sandbox"
        )
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(content=content, media_type=content_type, headers=headers)
