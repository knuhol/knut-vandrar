"""Shared translation queue, fingerprint, and slug helpers."""

import hashlib
import json
import unicodedata
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import Hike, HikeSlugAlias, HikeTranslation
from knut_vandrar_backend.models.translation import (
    TranslationGlossaryEntry,
    TranslationJob,
    TranslationProfile,
)
from knut_vandrar_backend.translations.policy import EXPLICIT_REASONS

TARGET_LOCALES = ("sv", "cs")
SOURCE_LOCALE = "en"


def profile_fingerprint(
    db: Session, content_type: str, locale: str
) -> tuple[TranslationProfile, str]:
    profile = db.scalar(
        select(TranslationProfile).where(
            TranslationProfile.content_type == content_type,
            TranslationProfile.target_locale == locale,
        )
    )
    if profile is None:
        raise LookupError(f"No translation profile configured for {content_type}/{locale}")
    entries = db.scalars(
        select(TranslationGlossaryEntry)
        .where(TranslationGlossaryEntry.profile_id == profile.id)
        .order_by(TranslationGlossaryEntry.source_term, TranslationGlossaryEntry.target_term)
    ).all()
    value = {
        "instructions": profile.instructions,
        "model": profile.model,
        "reasoning_effort": profile.reasoning_effort,
        "glossary": [
            {
                "source": entry.source_term,
                "target": entry.target_term,
                "context": entry.context,
                "do_not_translate": entry.do_not_translate,
            }
            for entry in entries
        ],
    }
    fingerprint = hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    return profile, fingerprint


def enqueue_translation(
    db: Session,
    hike: Hike,
    locale: str,
    reason: str,
    fingerprint: str | None = None,
) -> bool:
    # Serialize producers for this hike; flush because sessions disable autoflush.
    if reason not in EXPLICIT_REASONS:
        raise ValueError("Translation jobs require an explicit request")
    db.flush()
    db.execute(select(Hike.id).where(Hike.id == hike.id).with_for_update()).all()
    target = db.scalar(
        select(HikeTranslation).where(
            HikeTranslation.hike_id == hike.id, HikeTranslation.locale_code == locale
        )
    )
    if target is not None and target.review_status == TranslationReviewStatus.MANUAL:
        return False
    if fingerprint is None:
        _, fingerprint = profile_fingerprint(db, "hike", locale)
    active_jobs = db.scalars(
        select(TranslationJob).where(
            TranslationJob.entity_type == "hike",
            TranslationJob.entity_id == hike.id,
            TranslationJob.target_locale == locale,
            TranslationJob.status.in_(("queued", "running")),
        )
    ).all()
    for job in active_jobs:
        if job.reason not in EXPLICIT_REASONS:
            job.status = "superseded"
    active_jobs = [job for job in active_jobs if job.reason in EXPLICIT_REASONS]
    if any(
        job.source_revision == hike.source_revision and job.profile_fingerprint == fingerprint
        for job in active_jobs
    ):
        return False
    for job in active_jobs:
        if job.status == "queued":
            job.status = "superseded"
    db.add(
        TranslationJob(
            entity_type="hike",
            entity_id=hike.id,
            target_locale=locale,
            source_revision=hike.source_revision,
            profile_fingerprint=fingerprint,
            reason=reason,
            status="queued",
        )
    )
    db.flush()
    return True


def source_fields(translation: HikeTranslation) -> dict[str, str | None]:
    return {
        "title": translation.title,
        "tagline": translation.tagline,
        "summary_markdown": translation.summary_markdown,
        "description_markdown": translation.description_markdown,
    }


def source_fingerprint(translation: HikeTranslation) -> str:
    encoded = json.dumps(source_fields(translation), ensure_ascii=False, sort_keys=True).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()


def make_slug(title: str) -> str:
    normalized = unicodedata.normalize("NFKD", title).lower()
    characters: list[str] = []
    separator_pending = False
    for character in normalized:
        category = unicodedata.category(character)
        if category.startswith("M"):
            continue
        if character.isalnum():
            if separator_pending and characters:
                characters.append("-")
            characters.append(character)
            separator_pending = False
        else:
            separator_pending = True
    return "".join(characters) or "hike"


def unique_slug(db: Session, locale: str, title: str, hike_id: UUID) -> str:
    base = make_slug(title)
    candidate = base
    suffix = 2
    while True:
        existing = db.scalar(
            select(HikeTranslation.id).where(
                HikeTranslation.locale_code == locale,
                HikeTranslation.slug == candidate,
                HikeTranslation.hike_id != hike_id,
            )
        )
        alias = db.scalar(
            select(HikeSlugAlias.id).where(
                HikeSlugAlias.locale_code == locale,
                HikeSlugAlias.slug == candidate,
                HikeSlugAlias.hike_id != hike_id,
            )
        )
        if existing is None and alias is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1
