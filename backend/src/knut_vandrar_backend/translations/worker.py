"""Database-backed translation queue worker."""

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.database.session import SessionLocal
from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import (
    Hike,
    HikeSlugAlias,
    HikeTranslation,
    HikeTranslationVersion,
)
from knut_vandrar_backend.models.translation import (
    TranslationGlossaryEntry,
    TranslationJob,
    TranslationProfile,
)
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.translations.core import (
    profile_fingerprint,
    source_fields,
    unique_slug,
)
from knut_vandrar_backend.translations.openai_provider import TranslationResult, translate_hike

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def run_once(translate: Callable[..., TranslationResult] = translate_hike) -> bool:
    job_id = _claim_job()
    if job_id is None:
        return False
    try:
        _process(job_id, translate)
    except Exception as exc:  # Worker records failures for later retry.
        _record_failure(job_id, exc)
        logger.exception("Translation job %s failed", job_id)
    return True


def run_forever() -> None:
    logger.info("Translation worker started")
    _recover_abandoned_jobs()
    if settings.openai_api_key is None:
        raise RuntimeError("OPENAI_API_KEY is required to process translation jobs")
    while True:
        if not run_once():
            time.sleep(3)


def _claim_job() -> UUID | None:
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        job = db.scalar(
            select(TranslationJob)
            .where(
                TranslationJob.status == "queued",
                TranslationJob.available_at <= now,
            )
            .order_by(TranslationJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job is None:
            return None
        job.status = "running"
        job.attempts += 1
        return job.id


def _recover_abandoned_jobs() -> None:
    with SessionLocal.begin() as db:
        abandoned_before = datetime.now(UTC) - timedelta(minutes=10)
        jobs = db.scalars(
            select(TranslationJob).where(
                TranslationJob.status == "running",
                TranslationJob.updated_at < abandoned_before,
            )
        ).all()
        for job in jobs:
            job.status = "queued"


def _process(job_id: UUID, translate: Callable[..., TranslationResult]) -> None:
    with SessionLocal() as db:
        job = db.get(TranslationJob, job_id)
        if job is None:
            return
        if job.entity_type != "hike":
            raise RuntimeError(f"Unsupported translation entity type: {job.entity_type}")
        hike = db.get(Hike, job.entity_id)
        if hike is None:
            job.status = "superseded"
            db.commit()
            return
        english = db.scalar(
            select(HikeTranslation).where(
                HikeTranslation.hike_id == hike.id,
                HikeTranslation.locale_code == "en",
            )
        )
        if english is None:
            raise RuntimeError("English source translation is missing")
        profile = db.scalar(
            select(TranslationProfile).where(
                TranslationProfile.content_type == "hike",
                TranslationProfile.target_locale == job.target_locale,
            )
        )
        if profile is None:
            raise RuntimeError("Translation profile is missing")
        _, current_fingerprint = profile_fingerprint(db, "hike", job.target_locale)
        if (
            job.source_revision != hike.source_revision
            or job.profile_fingerprint != current_fingerprint
        ):
            job.status = "superseded"
            _queue_if_needed(db, hike, job.target_locale, current_fingerprint, "superseded")
            db.commit()
            return
        source = source_fields(english)
        entries = db.scalars(
            select(TranslationGlossaryEntry)
            .where(TranslationGlossaryEntry.profile_id == profile.id)
            .order_by(TranslationGlossaryEntry.source_term)
        ).all()
        job_data = {
            "api_key": settings.openai_api_key or "",
            "model": profile.model,
            "target_locale": job.target_locale,
            "instructions": profile.instructions,
            "glossary_entries": entries,
            "source_fields": source,
        }
    result: TranslationResult = translate(**job_data)
    _publish_result(job_id, result)


def _publish_result(job_id: UUID, result: TranslationResult) -> None:
    with SessionLocal.begin() as db:
        job = db.get(TranslationJob, job_id)
        if job is None:
            return
        hike = db.get(Hike, job.entity_id)
        if hike is None:
            job.status = "superseded"
            return
        _, current_fingerprint = profile_fingerprint(db, "hike", job.target_locale)
        if (
            job.source_revision != hike.source_revision
            or job.profile_fingerprint != current_fingerprint
        ):
            job.status = "superseded"
            _queue_if_needed(db, hike, job.target_locale, current_fingerprint, "superseded")
            return
        translation = db.scalar(
            select(HikeTranslation).where(
                HikeTranslation.hike_id == hike.id,
                HikeTranslation.locale_code == job.target_locale,
            )
        )
        if translation is None:
            translation = HikeTranslation(
                hike_id=hike.id,
                locale_code=job.target_locale,
                title=result.fields["title"] or "",
                summary_markdown=result.fields["summary_markdown"] or "",
                slug=unique_slug(db, job.target_locale, result.fields["title"] or "", hike.id),
            )
            db.add(translation)
            db.flush()
        new_slug = unique_slug(db, job.target_locale, result.fields["title"] or "", hike.id)
        if translation.slug != new_slug:
            old_alias = db.scalar(
                select(HikeSlugAlias).where(
                    HikeSlugAlias.locale_code == translation.locale_code,
                    HikeSlugAlias.slug == translation.slug,
                )
            )
            if old_alias is None:
                db.add(
                    HikeSlugAlias(
                        hike_id=hike.id,
                        locale_code=translation.locale_code,
                        slug=translation.slug,
                    )
                )
        translation.title = result.fields["title"] or ""
        translation.tagline = result.fields["tagline"]
        translation.summary_markdown = result.fields["summary_markdown"] or ""
        translation.description_markdown = result.fields["description_markdown"]
        translation.slug = new_slug
        translation.source_revision = hike.source_revision
        translation.profile_fingerprint = job.profile_fingerprint
        translation.review_status = TranslationReviewStatus.UNREVIEWED
        translation.provider = "openai"
        translation.model = result.model
        translation.generated_at = datetime.now(UTC)
        version = max((item.version for item in translation.versions), default=0) + 1
        db.add(
            HikeTranslationVersion(
                translation=translation,
                version=version,
                title=translation.title,
                tagline=translation.tagline,
                summary_markdown=translation.summary_markdown,
                description_markdown=translation.description_markdown,
                slug=translation.slug,
                source_revision=job.source_revision,
                profile_fingerprint=job.profile_fingerprint,
                provider="openai",
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                generated_at=translation.generated_at,
            )
        )
        job.status = "succeeded"
        job.last_error = None
        job.usage = {
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
        }


def _record_failure(job_id: UUID, error: Exception) -> None:
    with SessionLocal.begin() as db:
        job = db.get(TranslationJob, job_id)
        if job is None:
            return
        job.last_error = str(error)[:1000]
        if job.attempts >= MAX_ATTEMPTS:
            job.status = "failed"
        else:
            job.status = "queued"
            job.available_at = datetime.now(UTC) + timedelta(seconds=2**job.attempts * 15)


def _queue_if_needed(db: Session, hike: Hike, locale: str, fingerprint: str, reason: str) -> None:
    active = db.scalar(
        select(TranslationJob).where(
            TranslationJob.entity_type == "hike",
            TranslationJob.entity_id == hike.id,
            TranslationJob.target_locale == locale,
            TranslationJob.status.in_(("queued", "running")),
        )
    )
    if active is None:
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_forever()
