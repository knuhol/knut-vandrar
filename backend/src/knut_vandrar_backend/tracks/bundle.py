"""Read a local browser-extension export without contacting Plotaroute."""

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from pathlib import Path
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from knut_vandrar_backend.tracks.gpx import MAX_GPX_BYTES, NS, clean_name, normalize


def collection_id(value: str) -> str:
    match = re.fullmatch(
        r"(?:https://(?:www\.)?plotaroute\.com/routecollection/)?([1-9][0-9]*)/?", value
    )
    if not match:
        raise ValueError("Use a Plotaroute collection ID or routecollection URL")
    return match[1]


class CollectionReference(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(pattern=r"^[1-9][0-9]*$")
    url: str
    name: str = Field(min_length=1, max_length=3000)
    route_names: list[str] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def consistent_url(self) -> Self:
        if collection_id(self.url) != self.id:
            raise ValueError("Collection URL and ID disagree")
        if any(not name or len(name) > 3000 for name in self.route_names):
            raise ValueError("Invalid source route name")
        return self


class RouteReference(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    source_id: str = Field(pattern=r"^[1-9][0-9]*$")
    source_order: int = Field(ge=0, lt=1000)
    filename: str = Field(min_length=1, max_length=255)
    metadata: dict[str, str]

    @model_validator(mode="after")
    def valid_file(self) -> Self:
        if (
            "/" in self.filename
            or "\\" in self.filename
            or not self.filename.lower().endswith(".gpx")
        ):
            raise ValueError("GPX filename must be a plain filename, not a path")
        if not self.metadata.get("RouteName", "").strip():
            raise ValueError("Route metadata requires RouteName")
        return self


class BrowserBundle(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    format: Literal["knut-vandrar-plotaroute"]
    version: Literal[1]
    collection: CollectionReference
    routes: list[RouteReference] = Field(max_length=1000)

    @model_validator(mode="after")
    def unique_routes(self) -> Self:
        for field in ("source_id", "source_order", "filename"):
            values = [getattr(route, field) for route in self.routes]
            if len(set(values)) != len(values):
                raise ValueError(f"Duplicate route {field}")
        for route in self.routes:
            if route.source_order >= len(self.collection.route_names):
                raise ValueError("Route order exceeds collection size")
            if (
                route.metadata["RouteName"].strip()
                != self.collection.route_names[route.source_order]
            ):
                raise ValueError("Route metadata does not match collection membership")
        return self


class BundleSource:
    def __init__(self, manifest: Path, directory: Path | None = None) -> None:
        if manifest.stat().st_size > 10_000_000:
            raise ValueError("Browser manifest exceeds 10 MB")
        raw = manifest.read_bytes()
        self.bundle = BrowserBundle.model_validate(json.loads(raw))
        self.manifest = manifest.absolute()
        self.downloads: dict[Path, str] = {self.manifest: hashlib.sha256(raw).hexdigest()}
        self.directory = (directory or manifest.parent).resolve()

    @property
    def identifier(self) -> str:
        return self.bundle.collection.id

    def read(self, identifier: str) -> Iterator[dict[str, Any]]:
        if identifier != self.identifier:
            raise ValueError("Requested collection differs from browser export")
        count = len(self.bundle.collection.route_names)
        yield {
            "collection_name": self.bundle.collection.name,
            "expected": count,
            "membership_complete": len(self.bundle.routes) == count,
        }
        records = {route.source_order: route for route in self.bundle.routes}
        for index in range(count):
            route = records.get(index)
            if route is None:
                yield {
                    "source_id": f"stage:{index + 1}",
                    "source_order": index,
                    "error": "This stage has not been exported by the browser yet",
                }
                continue
            path = self.directory / route.filename
            if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_GPX_BYTES:
                yield {
                    "source_id": route.source_id,
                    "source_order": index,
                    "error": f"Missing, unsafe, or oversized GPX: {route.filename}",
                }
                continue
            try:
                raw = path.read_bytes()
                normalize(raw, route.metadata["RouteName"])
                track_name = ET.fromstring(raw).findtext(f"{NS}trk/{NS}name", default="")
                if clean_name(track_name) != clean_name(route.metadata["RouteName"]):
                    raise ValueError("GPX track name differs from exported route metadata")
            except (ValueError, KeyError) as error:
                yield {
                    "source_id": route.source_id,
                    "source_order": index,
                    "error": f"Invalid GPX {route.filename}: {error}",
                }
                continue
            metadata = {
                **route.metadata,
                "url": f"https://www.plotaroute.com/route/{route.source_id}",
            }
            self.downloads[path] = hashlib.sha256(raw).hexdigest()
            # Re-ingest local bytes to detect updates while preserving unchanged review state.
            yield {
                "source_id": route.source_id,
                "source_order": index,
                "metadata": metadata,
                "path": str(path),
            }


def offer_download_cleanup(source: BundleSource, *, protected_root: Path | None = None) -> None:
    """Only called after all routes have been published successfully."""
    count = len(source.downloads) - 1
    try:
        answer = (
            input(f"Remove {count} imported GPX downloads and {source.manifest.name}? [y/N]: ")
            .strip()
            .lower()
        )
    except (EOFError, KeyboardInterrupt):
        print("\nImport saved. Downloaded files kept.")
        return
    if answer not in {"y", "yes"}:
        print("Downloaded files kept.")
        return
    removed = 0
    # Delete the manifest last. Never remove changed files or follow symlinks.
    for path, digest in reversed(list(source.downloads.items())):
        if path == source.manifest and removed != count:
            print("Kept manifest because some GPX downloads could not be removed.")
            continue
        try:
            if protected_root is not None and path.resolve().is_relative_to(
                protected_root.resolve()
            ):
                print(f"Kept file in media storage: {path.name}")
                continue
            if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                print(f"Kept changed or unsafe file: {path.name}")
                continue
            path.unlink()
            removed += 1
        except OSError as error:
            print(f"Could not remove {path.name}: {error.strerror}")
    print(f"Removed {removed} downloaded files. Imported tracks are saved in media storage.")
