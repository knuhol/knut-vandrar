"""Shared, idempotent retranslation queue service for CLI and HTTP callers."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.translations.core import (
    TARGET_LOCALES,
    enqueue_translation,
    profile_fingerprint,
)


def queue_outdated_translations(db: Session) -> tuple[int, int]:
    queued = 0
    unchanged = 0
    flagged = db.scalars(
        select(HikeTranslation)
        .where(
            HikeTranslation.locale_code.in_(TARGET_LOCALES),
            HikeTranslation.review_status == "needs_retranslation",
        )
        .order_by(HikeTranslation.hike_id, HikeTranslation.locale_code)
    ).all()
    for translation in flagged:
        hike = db.get(Hike, translation.hike_id)
        if hike is None:
            continue
        _, fingerprint = profile_fingerprint(db, "hike", translation.locale_code)
        if enqueue_translation(
            db, hike, translation.locale_code, "needs_retranslation", fingerprint
        ):
            queued += 1
        else:
            unchanged += 1
    from knut_vandrar_backend.translations.content import CONTENT, enqueue_content

    for kind, spec in CONTENT.items():
        translations = db.scalars(
            select(spec.translation).where(spec.translation.review_status == "needs_retranslation")
        ).all()
        for translation in translations:
            entity = db.get(spec.entity, getattr(translation, spec.owner_key))
            if entity is not None:
                if enqueue_content(
                    db, kind, entity, translation.locale_code, "needs_retranslation"
                ):
                    queued += 1
                else:
                    unchanged += 1
    return queued, unchanged
