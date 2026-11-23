"""Generate desktop covers from stored originals without replacing existing assets."""

import hashlib
from uuid import UUID

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api.image_uploads import optimize_images
from knut_vandrar_backend.models.hike import HikeCoverAsset, HikeCoverImage

DESKTOP_COVER_VARIANTS = {"desktop": (2560, 80), "wide": (3840, 62)}
AVIF_COVER_VARIANTS = frozenset({"wide"})
COVER_VARIANTS = {
    "image": (3840, 86),
    **DESKTOP_COVER_VARIANTS,
    "mobile": (1600, 82),
    "card": (960, 82),
}
COVER_DERIVATIVE_TYPES = {
    kind: "image/avif" if kind in AVIF_COVER_VARIANTS else "image/webp"
    for kind in COVER_VARIANTS
    if kind != "image"
}


def backfill_desktop_covers(sessions: sessionmaker[Session]) -> int:
    missing_variant = or_(
        *(
            ~exists().where(
                HikeCoverAsset.hike_id == HikeCoverImage.hike_id, HikeCoverAsset.kind == kind
            )
            for kind in DESKTOP_COVER_VARIANTS
        )
    )
    candidates = (
        select(HikeCoverImage.hike_id)
        .where(HikeCoverImage.content_type != "image/svg+xml", missing_variant)
        .order_by(HikeCoverImage.hike_id)
        .limit(100)
    )
    cursor: UUID | None = None
    count = 0
    while True:
        with sessions() as db:
            query = (
                candidates if cursor is None else candidates.where(HikeCoverImage.hike_id > cursor)
            )
            hike_ids = db.scalars(query).all()
        if not hike_ids:
            return count
        cursor = hike_ids[-1]
        for hike_id in hike_ids:
            with sessions.begin() as db:
                cover = db.get(HikeCoverImage, hike_id, with_for_update=True)
                if cover is None or cover.content_type == "image/svg+xml":
                    continue
                missing = {
                    kind: options
                    for kind, options in DESKTOP_COVER_VARIANTS.items()
                    if kind not in cover.assets
                }
                if not missing:
                    continue

                original = cover.assets.get("original")
                source = original.content if original is not None else cover.content
                variants, _ = optimize_images(source, missing, avif_variants=AVIF_COVER_VARIANTS)
                for kind, image in variants.items():
                    cover.set_asset(kind, image, hashlib.sha256(image).hexdigest())
                count += 1
