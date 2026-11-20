"""Local single-route input using the same review pipeline as browser bundles."""

import xml.etree.ElementTree as ET
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from knut_vandrar_backend.tracks.gpx import MAX_GPX_BYTES, NS, clean_name, normalize

SINGLE_GPX_ID = "gpx:single"
TRACK_SOURCE_ID_PATTERN = r"^(?:[1-9][0-9]*|gpx:single)$"


class SingleGpxSource:
    identifier = SINGLE_GPX_ID

    def __init__(self, path: Path) -> None:
        self.path = path.expanduser().absolute()
        self._metadata()  # Validate before opening a database session or creating a draft.

    def _metadata(self) -> dict[str, str]:
        if self.path.is_symlink() or not self.path.is_file():
            raise ValueError("GPX file must be a regular file, not a symlink")
        if self.path.stat().st_size > MAX_GPX_BYTES:
            raise ValueError("GPX file exceeds 25 MB")
        raw = self.path.read_bytes()
        try:
            normalize(raw, self.path.stem)
        except KeyError as error:
            raise ValueError("Invalid GPX coordinates") from error
        root = ET.fromstring(raw.decode("utf-8-sig"))
        routes = root.findall(NS + "trk") + root.findall(NS + "rte")
        if len(routes) != 1:
            raise ValueError("Single GPX import requires exactly one track or route")
        route = routes[0]
        name = clean_name(
            route.findtext(NS + "name") or root.findtext(f"{NS}metadata/{NS}name") or self.path.stem
        )
        return {
            "RouteName": name or self.path.stem,
            "About": route.findtext(NS + "desc") or root.findtext(f"{NS}metadata/{NS}desc") or "",
        }

    def read(self, identifier: str) -> Iterator[dict[str, Any]]:
        if identifier != self.identifier:
            raise ValueError("Requested source differs from the single GPX import")
        metadata = self._metadata()
        yield {"collection_name": metadata["RouteName"], "expected": 1, "membership_complete": True}
        yield {
            "source_id": SINGLE_GPX_ID,
            "source_order": 0,
            "metadata": metadata,
            "path": str(self.path),
        }
