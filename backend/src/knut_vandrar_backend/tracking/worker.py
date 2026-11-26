"""Poll the single eligible hike, with a shared database lease and durable checkpoints."""

import logging
from datetime import UTC, datetime, timedelta
from urllib.error import HTTPError
from xml.etree.ElementTree import ParseError

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from knut_vandrar_backend.database.session import SessionLocal
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.tracking import GarminPoint, GarminSettings, GarminSync
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.tracking.garmin import fetch_fixes, utc

logger = logging.getLogger(__name__)
OVERLAP = timedelta(days=2)
MAX_WINDOW = timedelta(days=7)
LOCK_ID = 675_282_014


def ongoing_hikes(db: Session) -> list[Hike]:
    return list(db.scalars(select(Hike).where(Hike.status == HikeStatus.ONGOING).limit(2)))


def poll() -> None:
    feed_url = settings.garmin_feed_url
    if not feed_url:
        return
    with SessionLocal.begin() as db:
        if not db.scalar(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": LOCK_ID}):
            return
        config = db.get(GarminSettings, 1)
        if config is None or not config.active or not config.password:
            return
        hikes = ongoing_hikes(db)
        if len(hikes) != 1 or hikes[0].track_collection_id is None:
            return
        hike = hikes[0]
        now = datetime.now(UTC)
        sync = db.get(GarminSync, hike.id)
        interval = timedelta(seconds=settings.garmin_poll_seconds)
        if sync and (
            now - utc(sync.attempted_at) < interval
            or (sync.retry_after and now < utc(sync.retry_after))
        ):
            return
        # In the absence of an explicit start, only ingest fixes from activation onward.
        start = utc(
            hike.actual_start_at or hike.planned_start_at or (sync.started_at if sync else now)
        )
        if sync is None:
            sync = GarminSync(hike_id=hike.id, started_at=start)
            db.add(sync)
        if utc(sync.started_at) != start:
            sync.covered_until = None
        sync.started_at = start
        sync.attempted_at = now
        end = min(now, utc(hike.actual_end_at or now))
        if start >= end:
            return
        since = max(start, utc(sync.covered_until) - OVERLAP) if sync.covered_until else start
        end = min(end, since + MAX_WINDOW)
        if since >= end:
            return
        try:
            fixes = fetch_fixes(feed_url, config.password, since, end)
        except HTTPError as exc:
            if exc.code == 429:
                sync.retry_after = now + timedelta(hours=1)
            logger.warning("Garmin responded with HTTP %s for hike %s", exc.code, hike.id)
            return
        except (OSError, ValueError, ParseError) as exc:
            logger.warning("Garmin polling failed for hike %s (%s)", hike.id, type(exc).__name__)
            return
        rows = [
            {
                "hike_id": hike.id,
                "source_id": fix.source_id,
                "recorded_at": fix.recorded_at,
                "retrieved_at": fix.retrieved_at,
                "data": fix.data,
            }
            for fix in fixes
            if start <= fix.recorded_at <= end
        ]
        for offset in range(0, len(rows), 500):
            db.execute(
                insert(GarminPoint).values(rows[offset : offset + 500]).on_conflict_do_nothing()
            )
        sync.covered_until = end
        sync.retry_after = None
        sync.succeeded_at = now
