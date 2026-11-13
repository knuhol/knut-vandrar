"""Explicit, idempotent translation requests shared by HTTP and CLI callers."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.translations.content import CONTENT, enqueue_content
from knut_vandrar_backend.translations.core import enqueue_translation, profile_fingerprint
from knut_vandrar_backend.translations.selection import translation_candidates


def queue_outdated_translations(
    db: Session,
    *,
    include_outdated: bool = False,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    locale: str | None = None,
) -> tuple[int, int]:
    """Default to flagged entries; broader missing/outdated work requires opt-in."""
    candidates = translation_candidates(
        db,
        include_outdated=include_outdated,
        entity_type=entity_type,
        entity_id=entity_id,
        locale=locale,
    )
    queued = skipped = 0
    query = select(candidates).order_by(
        candidates.c.entity_type, candidates.c.entity_id, candidates.c.locale
    )
    for row in db.execute(query.execution_options(yield_per=100)).mappings():
        kind, target_locale = row["entity_type"], row["locale"]
        model = Hike if kind == "hike" else CONTENT[kind].entity
        entity = db.get(model, row["entity_id"])
        if entity is None:
            continue
        reason = (
            "needs_retranslation"
            if row["review_status"] == "needs_retranslation"
            else "explicit_request"
        )
        added = (
            enqueue_translation(
                db, entity, target_locale, reason, profile_fingerprint(db, kind, target_locale)[1]
            )
            if kind == "hike"
            else enqueue_content(db, kind, entity, target_locale, reason)
        )
        if added:
            queued += 1
        else:
            skipped += 1
    return queued, skipped
