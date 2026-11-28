"""Generate the shared photo collage from published hike galleries."""

import argparse
import json
import math
import random
import re
from collections.abc import Iterator
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, cast
from urllib.parse import urlencode
from urllib.request import urlopen

from PIL import Image, ImageFilter, ImageOps

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
OUTPUT = FRONTEND / "public/brand/hero-collage.webp"
CANVAS = (1920, 960)
PAGE_SIZE = 100


def fetch(api_url: str, path: str) -> bytes:
    with urlopen(f"{api_url}{path}", timeout=30) as response:
        return cast(bytes, response.read())


def pages(api_url: str, path: str) -> Iterator[dict[str, Any]]:
    offset = 0
    while True:
        query = urlencode({"locale": "sv", "limit": PAGE_SIZE, "offset": offset})
        page = json.loads(fetch(api_url, f"{path}?{query}"))
        items = page["items"]
        yield from items
        offset += len(items)
        if not items or offset >= page["total"]:
            return


def gallery_images(api_url: str) -> list[str]:
    return sorted(
        {
            photo["image_url"]
            for hike in pages(api_url, "/api/hikes")
            for photo in pages(api_url, f"/api/hikes/{hike['id']}/photos")
        }
    )


def cream_color() -> str:
    tokens = (FRONTEND / "src/styles/tokens.css").read_text()
    match = re.search(r"--color-cream:\s*(#[0-9a-fA-F]{6})\s*;", tokens)
    if match is None:
        raise ValueError("Expected a six-digit --color-cream in the frontend design tokens")
    return match[1]


def print_image(data: bytes, width: int, angle: float) -> Image.Image:
    height = round(width * 0.7)
    border = max(1, round(width * 0.025))
    with Image.open(BytesIO(data)) as source:
        crop = ImageOps.fit(
            ImageOps.grayscale(ImageOps.exif_transpose(source)),
            (width - 2 * border, height - 3 * border),
            method=Image.Resampling.LANCZOS,
        )
    paper = Image.new("RGBA", (width, height), "#fffaf0")
    paper.paste(ImageOps.colorize(crop, "#332a21", "#f8eedc"), (border, border))
    return paper.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)


def add_print(canvas: Image.Image, paper: Image.Image, center: tuple[float, float]) -> None:
    x = round(center[0] - paper.width / 2)
    y = round(center[1] - paper.height / 2)
    padding = 24
    mask = Image.new("L", (paper.width + 2 * padding, paper.height + 2 * padding))
    mask.paste(paper.getchannel("A"), (padding, padding))
    shadow = Image.new("RGBA", mask.size, "#493628")
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(7)).point(lambda value: value // 2))
    canvas.alpha_composite(shadow, (x - padding, y - padding + 6))
    canvas.alpha_composite(paper, (x, y))


def compose(
    api_url: str, photos: list[str], rng: random.Random, options: argparse.Namespace
) -> Image.Image:
    width, height = CANVAS
    columns = math.ceil(math.sqrt(len(photos) * width / height * 0.7))
    rows = math.ceil(len(photos) / columns)
    cream = Image.new("RGBA", CANVAS, cream_color())
    collage = cream.copy()

    per_row, extra = divmod(len(photos), rows)
    start = 0
    for row in range(rows):
        end = start + per_row + (row < extra)
        row_photos = photos[start:end]
        start = end
        cell_width = width / len(row_photos)
        cell_height = height / rows
        for column, photo in enumerate(row_photos):
            center = (
                (column + 0.5 + rng.uniform(-0.16, 0.16)) * cell_width,
                (row + 0.5 + rng.uniform(-0.16, 0.16)) * cell_height,
            )
            print_width = round(
                max(cell_width, cell_height / 0.7)
                * (1 + options.overlap)
                * options.scale
                * rng.uniform(0.88, 1.12)
            )
            angle = rng.uniform(-options.rotation, options.rotation)
            add_print(collage, print_image(fetch(api_url, photo), print_width, angle), center)

    # Give the prints behind the frosted header enough detail to show through.
    # Fade back to the configured tint before the main hero content.
    tint = options.tint_intensity
    top_tint = min(tint * 2.5, 1)
    tint_levels = []
    for y in range(height):
        top_weight = max(0, min(1, (0.28 - y / height) / 0.20))
        tint_levels.append(round(255 * (tint + (top_tint - tint) * top_weight)))

    tint_ramp = Image.new("L", (1, height))
    tint_ramp.putdata(tint_levels)
    mask = tint_ramp.resize(CANVAS, Image.Resampling.NEAREST)
    return Image.composite(collage, cream, mask).convert("RGB")


def save(image: Image.Image, output: Path) -> None:
    with TemporaryDirectory(dir=output.parent) as temporary:
        path = Path(temporary) / output.name
        image.save(path, format="WEBP", quality=82, method=6)
        # Keep the existing asset intact if discovery, decoding, or encoding fails.
        path.replace(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", required=True, help="Base URL of the public hike API")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--photo-count", type=int, default=12)
    parser.add_argument(
        "--rotation", type=float, default=14, help="Maximum degrees in either direction"
    )
    parser.add_argument("--scale", type=float, default=1, help="Multiplier for print dimensions")
    parser.add_argument(
        "--overlap", type=float, default=0.25, help="Extra print size relative to its grid cell"
    )
    parser.add_argument(
        "--tint-intensity", type=float, default=0.17, help="Print visibility against cream"
    )
    parser.add_argument("--seed", type=int)
    options = parser.parse_args()
    if not (
        1 <= options.photo_count <= 48
        and 0 <= options.rotation <= 45
        and 0.5 <= options.scale <= 1.5
        and 0 <= options.overlap <= 0.75
        and 0 <= options.tint_intensity <= 1
    ):
        parser.error(
            "Expected photo count 1–48, rotation 0–45, scale 0.5–1.5, overlap 0–0.75, and tint intensity 0–1"
        )

    api_url = options.api_url.rstrip("/")
    candidates = gallery_images(api_url)
    if not candidates:
        parser.error("No published hike gallery photographs found")

    rng = random.Random(options.seed)
    selection = rng.sample(candidates, min(options.photo_count, len(candidates)))
    save(compose(api_url, selection, rng, options), options.output)
    print(f"Saved {options.output} using {len(selection)} of {len(candidates)} gallery photographs")


if __name__ == "__main__":
    main()
