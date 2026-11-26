"""Read MapShare's individual placemarks, ignoring combined tracks and device metadata."""

import base64
import math
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_KML_BYTES = 16 * 1024 * 1024


@dataclass(frozen=True)
class Fix:
    source_id: str
    recorded_at: datetime
    retrieved_at: datetime | None
    data: dict[str, Any]


def _number(value: str) -> float | None:
    match = re.match(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)", value.strip())
    if match:
        number = float(match.group())
        if math.isfinite(number):
            return number
    return None


def utc(timestamp: datetime) -> datetime:
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=UTC)
    return timestamp.astimezone(UTC)


def _timestamp(value: str) -> datetime:
    try:
        timestamp = datetime.fromisoformat(value)
    except ValueError:
        timestamp = datetime.strptime(value, "%m/%d/%Y %I:%M:%S %p")
    return utc(timestamp)


def parse_kml(raw: bytes, retrieved_at: datetime | None = None) -> list[Fix]:
    if len(raw) > MAX_KML_BYTES:
        raise ValueError("MapShare KML exceeds the response limit")
    # Garmin serves UTF-8. Decode before rejecting DTDs so an alternate XML encoding
    # cannot hide entity declarations from the check.
    content = raw.decode("utf-8-sig")
    if "<!DOCTYPE" in content or "<!ENTITY" in content:
        raise ValueError("MapShare KML must not contain declarations")
    root = ET.fromstring(content)
    if root.tag.rsplit("}", 1)[-1] != "kml":
        raise ValueError("Expected a MapShare KML document")
    fixes = {}
    for item in root.findall(".//{*}Placemark"):
        fields = {
            data.get("name"): (data.findtext("{*}value") or "").strip()
            for data in item.findall("./{*}ExtendedData/{*}Data")
        }
        source_id = fields.get("Id", "")
        if not source_id or len(source_id) > 128:
            continue
        try:
            timestamp = _timestamp(fields.get("Time UTC", ""))
        except ValueError:
            continue
        lat = _number(fields.get("Latitude", ""))
        lon = _number(fields.get("Longitude", ""))
        valid = (
            fields.get("Valid GPS Fix", "").lower() == "true"
            and lat is not None
            and lon is not None
            and -90 <= lat <= 90
            and -180 <= lon <= 180
        )
        fixes[source_id] = Fix(
            source_id,
            timestamp,
            retrieved_at,
            {
                "coordinates": [lon, lat] if valid else None,
                "recorded_coordinates": [lon, lat] if lon is not None and lat is not None else None,
                "valid": valid,
                "event": fields.get("Event", ""),
                "elevation": _number(fields.get("Elevation", "")),
                "velocity": _number(fields.get("Velocity", "")),
                "course": _number(fields.get("Course", "")),
                "text": fields.get("Text") or None,
                "note": fields.get("Note") or None,
            },
        )
    return sorted(fixes.values(), key=lambda fix: (fix.recorded_at, fix.source_id))


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        return None


def fetch_fixes(feed_url: str, password: str, start: datetime, end: datetime) -> list[Fix]:
    query = urlencode(
        {key: date.strftime("%Y-%m-%dT%H:%M:%SZ") for key, date in (("d1", start), ("d2", end))}
    )
    auth = base64.b64encode(f"mapshare:{password}".encode()).decode()
    request = Request(f"{feed_url}?{query}", headers={"Authorization": f"Basic {auth}"})
    with build_opener(_NoRedirect()).open(request, timeout=15) as response:
        raw = response.read(MAX_KML_BYTES + 1)
    return parse_kml(raw, datetime.now(UTC))
