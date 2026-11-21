"""Repository-owned configuration and deterministic generation identities."""

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[4]


def load_config(root: Path = ROOT) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
    config = json.loads((root / "maps/config.json").read_text())
    style = json.loads((root / "maps/vandrar.json").read_text())
    tokens = dict(
        re.findall(
            r"--color-([\w-]+):\s*(#[0-9a-fA-F]{6});",
            (root / "frontend/src/styles/tokens.css").read_text(),
        )
    )
    # Resolve the project's existing paper color-mix without duplicating its value.
    css = (root / "frontend/src/styles/tokens.css").read_text()
    paper = re.search(
        r"--color-paper:\s*color-mix\(in srgb, var\(--color-([\w-]+)\) ([\d.]+)%, white\);", css
    )
    if paper:
        base = tokens[paper.group(1)].removeprefix("#")
        fraction = float(paper.group(2)) / 100
        tokens["paper"] = "#" + "".join(
            f"{math.floor(int(base[i : i + 2], 16) * fraction + 255 * (1 - fraction) + 0.5):02x}"
            for i in (0, 2, 4)
        )
    illustration = config["illustration"]
    if illustration["profile"] not in ("auto", "1", "2", "3", "4", "5"):
        raise ValueError("Invalid illustration profile")
    ratio = config["render"]["pixelRatio"]
    if type(ratio) is not int or ratio < 1 or ratio > 4:
        raise ValueError("Map pixelRatio must be an integer from 1 to 4")
    if not config["variants"] or len(config["variants"]) > 20:
        raise ValueError("Configure between 1 and 20 map variants")
    for name, low, high in (
        ("padding", 0, 500),
        ("maxZoom", 0, 22),
        ("timeoutMs", 1000, 300000),
        ("webpQuality", 1, 100),
        ("circularThresholdMetres", 0, 1000),
    ):
        value = config["render"][name]
        if type(value) is not int or not low <= value <= high:
            raise ValueError(f"Invalid map rendering setting: {name}")
    if not config["attribution"].strip():
        raise ValueError("Map attribution must not be empty")
    for name, dims in config["variants"].items():
        if not re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", name):
            raise ValueError("Invalid map variant name")
        width, height = dims["width"], dims["height"]
        if (
            any(type(n) is not int or n < 1 or n > 10000 or n % ratio for n in (width, height))
            or width * height > 40_000_000
        ):
            raise ValueError("Invalid map dimensions or pixelRatio")
        if min(width, height) / ratio <= config["render"]["padding"] * 2:
            raise ValueError("Map padding leaves no visible map")
    for key, value in config["overlay"].items():
        if key.endswith("Token") and value not in tokens:
            raise ValueError(f"Map color token is unavailable: {value}")
    return config, style, tokens


def fingerprint(inputs: dict[str, Any], root: Path = ROOT) -> str:
    digest = hashlib.sha256(json.dumps(inputs, sort_keys=True, separators=(",", ":")).encode())
    for name in (
        "maps/config.json",
        "maps/vandrar.json",
        "maps/style.mjs",
        "maps/illustration.mjs",
        "maps/detail.mjs",
        "maps/topography.mjs",
        "maps/attribution.mjs",
        "maps/topography.json",
        "maps/data/countries.json",
        "backend/src/knut_vandrar_backend/maps/progress.py",
        "tools/maps/render.mjs",
        "backend/src/knut_vandrar_backend/maps/geometry.py",
        "backend/src/knut_vandrar_backend/maps/cli.py",
        "backend/src/knut_vandrar_backend/maps/config.py",
        "frontend/src/styles/tokens.css",
        "package-lock.json",
        "backend/constraints.txt",
    ):
        digest.update(name.encode())
        digest.update((root / name).read_bytes())
    return digest.hexdigest()
