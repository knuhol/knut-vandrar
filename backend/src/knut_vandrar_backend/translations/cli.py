"""Queue missing, outdated, or explicitly flagged translations."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.database.session import SessionLocal
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.translations.core import (
    TARGET_LOCALES,
    enqueue_translation,
    profile_fingerprint,
)


def queue_outdated_translations(db: Session) -> tuple[int, int]:
    queued = 0
    unchanged = 0
    for hike in db.scalars(select(Hike).order_by(Hike.created_at)).all():
        translations = {
            item.locale_code: item
            for item in db.scalars(
                select(HikeTranslation).where(HikeTranslation.hike_id == hike.id)
            ).all()
        }
        for locale in TARGET_LOCALES:
            translation = translations.get(locale)
            _, fingerprint = profile_fingerprint(db, "hike", locale)
            is_missing = translation is None
            is_outdated = translation is not None and (
                translation.source_revision != hike.source_revision
                or translation.profile_fingerprint != fingerprint
            )
            needs_rerun = (
                translation is not None and translation.review_status == "needs_retranslation"
            )
            if not (is_missing or is_outdated or needs_rerun):
                unchanged += 1
                continue
            reason = (
                "missing" if is_missing else "needs_retranslation" if needs_rerun else "outdated"
            )
            queued += enqueue_translation(db, hike, locale, reason, fingerprint)
    return queued, unchanged


def main() -> int:
    with SessionLocal.begin() as db:
        queued, unchanged = queue_outdated_translations(db)
    print(f"Queued {queued} translation job(s); {unchanged} translation(s) are current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
