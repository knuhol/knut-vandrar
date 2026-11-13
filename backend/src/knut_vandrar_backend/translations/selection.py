"""Database-side selection shared by explicit requests and their read-only preview."""

from typing import Any
from uuid import UUID

from sqlalchemy import String, and_, cast, exists, literal, or_, select, union_all
from sqlalchemy.orm import Session, aliased
from sqlalchemy.sql.selectable import Subquery

from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.models.translation import TranslationJob
from knut_vandrar_backend.translations.content import CONTENT
from knut_vandrar_backend.translations.core import TARGET_LOCALES, profile_fingerprint
from knut_vandrar_backend.translations.policy import EXPLICIT_REASONS


def translation_candidates(
    db: Session,
    *,
    include_outdated: bool = False,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    locale: str | None = None,
) -> Subquery:
    """Select eligible entity/language pairs without queueing or provider calls."""
    queries: list[Any] = []
    for kind in ("hike", *CONTENT):
        if entity_type is not None and kind != entity_type:
            continue
        model: Any = Hike if kind == "hike" else CONTENT[kind].entity
        translation: Any = HikeTranslation if kind == "hike" else CONTENT[kind].translation
        owner_key = "hike_id" if kind == "hike" else CONTENT[kind].owner_key
        source = aliased(translation)
        target = aliased(translation)
        for target_locale in (locale,) if locale is not None else TARGET_LOCALES:
            fingerprint = profile_fingerprint(db, kind, target_locale)[1]
            missing = getattr(target, owner_key).is_(None)
            flagged = target.review_status == TranslationReviewStatus.NEEDS_RETRANSLATION
            outdated = or_(
                missing,
                target.source_revision != model.source_revision,
                target.profile_fingerprint.is_distinct_from(fingerprint),
            )
            active = exists(
                select(TranslationJob.id).where(
                    TranslationJob.entity_type == kind,
                    TranslationJob.entity_id == model.id,
                    TranslationJob.target_locale == target_locale,
                    TranslationJob.source_revision == model.source_revision,
                    TranslationJob.profile_fingerprint == fingerprint,
                    TranslationJob.reason.in_(EXPLICIT_REASONS),
                    TranslationJob.status.in_(("queued", "running")),
                )
            )
            title = getattr(source, "title" if kind in {"hike", "achievement"} else "name")
            query = (
                select(
                    literal(kind).label("entity_type"),
                    model.id.label("entity_id"),
                    title.label("title"),
                    literal(target_locale).label("locale"),
                    cast(target.review_status, String).label("review_status"),
                    missing.label("is_missing"),
                    outdated.label("is_outdated"),
                    active.label("already_queued"),
                )
                .select_from(model)
                .join(
                    source, and_(getattr(source, owner_key) == model.id, source.locale_code == "en")
                )
                .outerjoin(
                    target,
                    and_(
                        getattr(target, owner_key) == model.id, target.locale_code == target_locale
                    ),
                )
                .where(or_(missing, target.review_status != TranslationReviewStatus.MANUAL))
                .where(or_(flagged, outdated) if include_outdated else flagged)
            )
            if entity_id is not None:
                query = query.where(model.id == entity_id)
            queries.append(query)
    return union_all(*queries).subquery()
