"""Invalidate the public site's content cache after committed content changes."""

import logging
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy import event
from sqlalchemy.orm import Session

from knut_vandrar_backend.settings import settings

logger = logging.getLogger(__name__)
CONTENT_TABLES = {
    "hikes",
    "hike_translations",
    "hike_info_cards",
    "hike_cover_images",
    "trails",
    "trail_countries",
    "trail_logos",
}


@event.listens_for(Session, "after_flush")
def track_content_changes(session: Session, flush_context: object) -> None:
    for item in session.new | session.dirty | session.deleted:
        if getattr(item, "__tablename__", None) in CONTENT_TABLES:
            session.info["invalidate_content"] = True
            break


@event.listens_for(Session, "after_commit")
def invalidate_content(session: Session) -> None:
    changed = session.info.pop("invalidate_content", False)
    if (
        not changed
        or not settings.frontend_revalidation_url
        or not settings.cache_revalidation_secret
    ):
        return
    request = Request(
        settings.frontend_revalidation_url,
        data=b"{}",
        headers={"Authorization": f"Bearer {settings.cache_revalidation_secret}"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=3):
            pass
    except (URLError, TimeoutError, OSError):
        logger.warning(
            "Frontend cache notification failed; the five-minute cache expiry will refresh content"
        )


@event.listens_for(Session, "after_rollback")
def clear_pending_invalidation(session: Session) -> None:
    session.info.pop("invalidate_content", None)
