"""Repository-owned interactive map configuration."""

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
    for key, value in config["overlay"].items():
        if key.endswith("Token") and value not in tokens:
            raise ValueError(f"Map color token is unavailable: {value}")
    return config, style, tokens
