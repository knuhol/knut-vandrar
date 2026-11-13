"""Translation processing for destinations, regions and achievements."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select

from knut_vandrar_backend.database.session import SessionLocal
from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.translation import TranslationGlossaryEntry, TranslationJob
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.translations.content import (
    CONTENT,
    snapshot,
    translation_for,
)
from knut_vandrar_backend.translations.core import profile_fingerprint
from knut_vandrar_backend.translations.policy import EXPLICIT_REASONS


def process_content(job_id: UUID, translate: Any) -> None:
    with SessionLocal() as db:
        job = db.get(TranslationJob, job_id)
        if job is None:
            return
        if job.reason not in EXPLICIT_REASONS:
            job.status = "superseded"
            db.commit()
            return
        spec = CONTENT[job.entity_type]
        entity = db.get(spec.entity, job.entity_id)
        target = translation_for(db, job.entity_type, job.entity_id, job.target_locale)
        if entity is None or (target and target.review_status == TranslationReviewStatus.MANUAL):
            job.status = "superseded"
            db.commit()
            return
        profile, fingerprint = profile_fingerprint(db, job.entity_type, job.target_locale)
        if entity.source_revision != job.source_revision or fingerprint != job.profile_fingerprint:
            job.status = "superseded"
            db.commit()
            return
        source = translation_for(db, job.entity_type, entity.id, "en")
        source_fields = {key: getattr(source, key) for key in spec.fields}
        arguments = dict(
            api_key=settings.openai_api_key or "",
            model=profile.model,
            reasoning_effort=profile.reasoning_effort,
            target_locale=job.target_locale,
            instructions=profile.instructions,
            glossary_entries=list(
                db.scalars(
                    select(TranslationGlossaryEntry).where(
                        TranslationGlossaryEntry.profile_id == profile.id
                    )
                )
            ),
            source_fields=source_fields,
        )
    result = translate(**arguments)
    with SessionLocal.begin() as db:
        job = db.get(TranslationJob, job_id)
        if job is None:
            return
        spec = CONTENT[job.entity_type]
        entity = db.scalar(
            select(spec.entity).where(spec.entity.id == job.entity_id).with_for_update()
        )
        target = translation_for(db, job.entity_type, job.entity_id, job.target_locale)
        if entity is None or (target and target.review_status == TranslationReviewStatus.MANUAL):
            job.status = "superseded"
            return
        _, fingerprint = profile_fingerprint(db, job.entity_type, job.target_locale)
        if entity.source_revision != job.source_revision or fingerprint != job.profile_fingerprint:
            job.status = "superseded"
            return
        from knut_vandrar_backend.api.schemas.location import (
            AchievementEnglish,
            LocationEnglish,
            RegionEnglish,
        )
        from knut_vandrar_backend.api.schemas.photo import PhotoEnglish

        schemas: dict[str, type[BaseModel]] = {
            "photo": PhotoEnglish,
            "location": LocationEnglish,
            "region": RegionEnglish,
            "achievement": AchievementEnglish,
        }
        schema = schemas[job.entity_type]
        fields = schema.model_validate(result.fields).model_dump()
        if target is None:
            target = spec.translation(**{spec.owner_key: entity.id}, locale_code=job.target_locale)
            db.add(target)
        for key, value in fields.items():
            setattr(target, key, value)
        target.source_revision = entity.source_revision
        target.profile_fingerprint = fingerprint
        target.review_status = TranslationReviewStatus.UNREVIEWED
        target.provider, target.model = "openai", result.model
        target.generated_at = datetime.now(UTC)
        snapshot(db, job.entity_type, entity, target)
        job.status, job.last_error = "succeeded", None
        job.usage = {"input_tokens": result.input_tokens, "output_tokens": result.output_tokens}
