"""Registry and shared translation lifecycle for reusable authored content."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.location import (
    AchievementTranslation,
    HikeAchievement,
    HikingLocation,
    LocationTranslation,
    Region,
    RegionTranslation,
)
from knut_vandrar_backend.models.translation import TranslationJob
from knut_vandrar_backend.translations.core import profile_fingerprint
from knut_vandrar_backend.translations.policy import EXPLICIT_REASONS


@dataclass(frozen=True)
class ContentSpec:
    entity: Any
    translation: Any
    owner_key: str
    fields: tuple[str, ...]


CONTENT = {
    "location": ContentSpec(
        HikingLocation,
        LocationTranslation,
        "location_id",
        ("name", "season_note", "overnight_restrictions_note"),
    ),
    "region": ContentSpec(Region, RegionTranslation, "region_id", ("name",)),
    "achievement": ContentSpec(
        HikeAchievement, AchievementTranslation, "achievement_id", ("title", "description")
    ),
}


def translation_for(db: Session, kind: str, entity_id: UUID, locale: str) -> Any:
    spec = CONTENT[kind]
    return db.get(spec.translation, (entity_id, locale))


def enqueue_content(db: Session, kind: str, entity: Any, locale: str, reason: str) -> bool:
    spec = CONTENT[kind]
    if reason not in EXPLICIT_REASONS:
        raise ValueError("Translation jobs require an explicit request")
    db.flush()
    db.execute(select(spec.entity.id).where(spec.entity.id == entity.id).with_for_update()).all()
    target = translation_for(db, kind, entity.id, locale)
    if target is not None and target.review_status == TranslationReviewStatus.MANUAL:
        return False
    _, fingerprint = profile_fingerprint(db, kind, locale)
    jobs = db.scalars(
        select(TranslationJob).where(
            TranslationJob.entity_type == kind,
            TranslationJob.entity_id == entity.id,
            TranslationJob.target_locale == locale,
            TranslationJob.status.in_(("queued", "running")),
        )
    ).all()
    for job in jobs:
        if job.reason not in EXPLICIT_REASONS:
            job.status = "superseded"
    jobs = [job for job in jobs if job.reason in EXPLICIT_REASONS]
    if any(
        job.source_revision == entity.source_revision and job.profile_fingerprint == fingerprint
        for job in jobs
    ):
        return False
    for job in jobs:
        if job.status == "queued":
            job.status = "superseded"
    db.add(
        TranslationJob(
            entity_type=kind,
            entity_id=entity.id,
            target_locale=locale,
            source_revision=entity.source_revision,
            profile_fingerprint=fingerprint,
            reason=reason,
            status="queued",
        )
    )
    return True


def set_source(db: Session, kind: str, entity: Any, fields: dict[str, Any]) -> None:
    spec = CONTENT[kind]
    source = translation_for(db, kind, entity.id, "en")
    changed = source is None or any(getattr(source, key) != value for key, value in fields.items())
    if source is None:
        source = spec.translation(
            **{spec.owner_key: entity.id},
            locale_code="en",
            review_status=TranslationReviewStatus.SOURCE,
            **fields,
        )
        db.add(source)
    elif changed:
        entity.source_revision += 1
        for key, value in fields.items():
            setattr(source, key, value)
    source.source_revision = entity.source_revision
    db.flush()


def localized(db: Session, kind: str, entity: Any, locale: str) -> tuple[Any, dict[str, Any]]:
    target = translation_for(db, kind, entity.id, locale)
    if target is None:
        target = translation_for(db, kind, entity.id, "en")
    if target is None:
        raise LookupError("English source translation is missing")
    outdated = False
    if target.locale_code != "en":
        outdated = (
            target.source_revision != entity.source_revision
            or target.profile_fingerprint != profile_fingerprint(db, kind, target.locale_code)[1]
        )
    return target, {
        "locale": target.locale_code,
        "review_status": target.review_status,
        "is_outdated": outdated,
    }


def snapshot(db: Session, kind: str, entity: Any, translation: Any) -> None:
    from sqlalchemy import func

    from knut_vandrar_backend.models.translation import ContentTranslationVersion

    version = (
        db.scalar(
            select(func.max(ContentTranslationVersion.version)).where(
                ContentTranslationVersion.entity_type == kind,
                ContentTranslationVersion.entity_id == entity.id,
                ContentTranslationVersion.target_locale == translation.locale_code,
            )
        )
        or 0
    )
    db.add(
        ContentTranslationVersion(
            entity_type=kind,
            entity_id=entity.id,
            target_locale=translation.locale_code,
            version=version + 1,
            fields={key: getattr(translation, key) for key in CONTENT[kind].fields},
            source_revision=translation.source_revision,
            review_status=translation.review_status,
            profile_fingerprint=translation.profile_fingerprint,
            provider=translation.provider,
            model=translation.model,
        )
    )
