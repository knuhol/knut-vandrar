"""Validate and normalize GPX without simplifying geometry or removing POIs."""

import hashlib
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

NS = "{http://www.topografix.com/GPX/1/1}"
MAX_GPX_BYTES = 25_000_000


def clean_name(value: str) -> str:
    return re.sub(r"\s*[←→]\s*$", "", value).strip()


def endpoints(value: str) -> tuple[str | None, str | None]:
    parts = value.strip().split(" - ")
    if (
        len(parts) == 2
        and all(part.strip() for part in parts)
        and not any(char in value for char in "\r\n")
    ):
        return parts[0].strip(), parts[1].strip()
    return None, None


def normalize(data: bytes, name: str) -> tuple[bytes, dict[str, Any]]:
    if len(data) > MAX_GPX_BYTES or b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("Unsafe or oversized GPX")
    try:
        root = ET.fromstring(data.decode("utf-8-sig"))
    except ET.ParseError as error:
        raise ValueError("Invalid GPX XML") from error
    if root.tag != NS + "gpx":
        raise ValueError("Expected GPX 1.1")
    for route in root.findall(NS + "rte"):
        track = ET.Element(NS + "trk", route.attrib)
        segment = ET.Element(NS + "trkseg")
        for child in list(route):
            if child.tag == NS + "rtept":
                child.tag = NS + "trkpt"
                segment.append(child)
            else:
                track.append(child)
        track.append(segment)
        root.remove(route)
        root.append(track)
    points = root.findall(f".//{NS}trkpt")
    if len(points) < 2:
        raise ValueError("GPX must contain a track with at least two points")
    for point in points + root.findall(NS + "wpt"):
        lat, lon = float(point.attrib["lat"]), float(point.attrib["lon"])
        if not (
            math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180
        ):
            raise ValueError("Invalid GPX coordinates")
    for parent in root.iter():
        for child in list(parent):
            if child.tag == NS + "time":
                parent.remove(child)  # Plotaroute exports synthetic travel times.
    for track in root.findall(NS + "trk"):
        title = track.find(NS + "name")
        if title is None:
            title = ET.SubElement(track, NS + "name")
        title.text = clean_name(name)
    result = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return result, {
        "point_count": len(points),
        "segment_count": len(root.findall(f".//{NS}trkseg")),
        "start_coordinates": points[0].attrib,
        "end_coordinates": points[-1].attrib,
        "pois": [
            {
                "latitude": p.attrib["lat"],
                "longitude": p.attrib["lon"],
                **{c.tag.removeprefix(NS): c.text for c in p},
            }
            for p in root.findall(NS + "wpt")
        ],
    }


def track_path(root: Path, digest: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("Invalid track digest")
    directory = root / "tracks" / digest[:2]
    for path in (root, root / "tracks", directory):
        if path.is_symlink():
            raise ValueError("Unsafe track storage path")
    path = directory / (digest + ".gpx")
    if path.is_symlink():
        raise ValueError("Unsafe track file")
    return path


def store(root: Path, data: bytes) -> str:
    import os
    from tempfile import NamedTemporaryFile

    digest = hashlib.sha256(data).hexdigest()
    path = track_path(root, digest)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with NamedTemporaryFile(dir=path.parent) as temporary:
        temporary.write(data)
        temporary.flush()
        os.fsync(temporary.fileno())
        try:
            os.link(temporary.name, path)
        except FileExistsError:
            if path.read_bytes() != data:
                raise ValueError("Track checksum mismatch") from None
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    return digest
