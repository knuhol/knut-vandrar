"""Explicit, idempotent translation requests shared by HTTP and CLI callers."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.translations.content import CONTENT, enqueue_content, translation_for
from knut_vandrar_backend.translations.core import (
    TARGET_LOCALES,
    enqueue_translation,
    profile_fingerprint,
)


def queue_outdated_translations(
    db: Session,
    *,
    include_outdated: bool = False,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    locale: str | None = None,
) -> tuple[int, int]:
    """Default to flagged entries; broader missing/outdated work requires opt-in."""
    queued = skipped = 0
    for kind in ("hike", *CONTENT):
        if entity_type is not None and kind != entity_type:
            continue
        model = Hike if kind == "hike" else CONTENT[kind].entity
        query = select(model).order_by(model.id)
        if not include_outdated:
            translation_model = HikeTranslation if kind == "hike" else CONTENT[kind].translation
            owner = (
                translation_model.hike_id
                if kind == "hike"
                else getattr(translation_model, CONTENT[kind].owner_key)
            )
            query = (
                query.join(translation_model, owner == model.id)
                .where(
                    translation_model.review_status == TranslationReviewStatus.NEEDS_RETRANSLATION,
                    translation_model.locale_code.in_(
                        (locale,) if locale is not None else TARGET_LOCALES
                    ),
                )
                .distinct()
            )
        if entity_id is not None:
            query = query.where(model.id == entity_id)
        for entity in db.scalars(query.execution_options(yield_per=100)):
            for target_locale in (locale,) if locale is not None else TARGET_LOCALES:
                target: Any = (
                    db.scalar(
                        select(HikeTranslation).where(
                            HikeTranslation.hike_id == entity.id,
                            HikeTranslation.locale_code == target_locale,
                        )
                    )
                    if kind == "hike"
                    else translation_for(db, kind, entity.id, target_locale)
                )
                if target is not None and target.review_status == TranslationReviewStatus.MANUAL:
                    continue
                flagged = (
                    target is not None
                    and target.review_status == TranslationReviewStatus.NEEDS_RETRANSLATION
                )
                if not flagged and not include_outdated:
                    continue
                fingerprint = profile_fingerprint(db, kind, target_locale)[1]
                outdated = (
                    target is None
                    or target.source_revision != entity.source_revision
                    or target.profile_fingerprint != fingerprint
                )
                if not flagged and not outdated:
                    continue
                reason = "needs_retranslation" if flagged else "explicit_request"
                added = (
                    enqueue_translation(db, entity, target_locale, reason, fingerprint)
                    if kind == "hike"
                    else enqueue_content(db, kind, entity, target_locale, reason)
                )
                if added:
                    queued += 1
                else:
                    skipped += 1
    return queued, skipped
