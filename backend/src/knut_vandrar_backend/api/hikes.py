"""Public CRUD routes for hikes and localized reading."""

import hashlib
from datetime import UTC, datetime
from decimal import Decimal
from math import ceil
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import TypeAdapter
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from knut_vandrar_backend.api.authored import read_authored
from knut_vandrar_backend.api.hike_categories import long_distance_condition
from knut_vandrar_backend.api.image_uploads import (
    IMAGE_RESPONSES,
    PhotoBody,
    image_response,
    optimize_images,
)
from knut_vandrar_backend.api.locations import read_location
from knut_vandrar_backend.api.schemas.hike import (
    HikeCoverSources,
    HikeEnglishContent,
    HikeLocalizedRead,
    HikeMapRead,
    HikeNeighborRead,
    HikeNeighborsRead,
    HikeRead,
    HikeSlugRead,
    HikeSummaryRead,
    HikeWrite,
    InfoCard,
    TranslationReviewWrite,
)
from knut_vandrar_backend.api.schemas.location import AchievementRead
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.enums import HikeStatus, TranslationReviewStatus
from knut_vandrar_backend.models.hike import (
    CoverVariant,
    Hike,
    HikeCoverAsset,
    HikeCoverImage,
    HikeInfoCard,
    HikeSlugAlias,
    HikeTranslation,
)
from knut_vandrar_backend.models.location import (
    HikeAchievement,
    HikeGeographicLabel,
    HikeGeographicLabelTranslation,
    HikeOvernight,
    HikingLocation,
)
from knut_vandrar_backend.models.map import HikeMapImage
from knut_vandrar_backend.models.reference import InfoCardType
from knut_vandrar_backend.models.translation import TranslationJob
from knut_vandrar_backend.tracks.selection import validate_selection
from knut_vandrar_backend.translations.content import set_manual, set_source
from knut_vandrar_backend.translations.core import (
    SOURCE_LOCALE,
    TARGET_LOCALES,
    profile_fingerprint,
    unique_slug,
)

router = APIRouter(prefix="/api/hikes", tags=["hikes"])
DatabaseSession = Annotated[Session, Depends(get_db)]
COVER_VARIANTS = {"image": (3840, 86), "mobile": (1600, 82), "card": (960, 82)}


@router.get("", response_model=Page[HikeSummaryRead])
def list_hikes(
    request: Request,
    db: DatabaseSession,
    locale: str = SOURCE_LOCALE,
    limit: Limit = 10,
    offset: Offset = 0,
    category: Literal["long_distance", "multi_day"] | None = None,
) -> Page[HikeSummaryRead]:
    _require_locale(db, locale)
    query = select(HikeTranslation).join(Hike).where(HikeTranslation.locale_code == locale)
    if category is not None:
        long_distance = long_distance_condition()
        query = query.where(long_distance if category == "long_distance" else ~long_distance)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    covers = selectinload(HikeTranslation.hike).selectinload(Hike.cover_image)
    translations = db.scalars(
        query.options(covers.selectinload(HikeCoverImage.assets))
        .order_by(*_hike_order())
        .limit(limit)
        .offset(offset)
    ).all()
    return Page(
        items=[
            _summary(db, translation.hike, translation, request) for translation in translations
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


def _hike_order(reverse: bool = False) -> tuple[Any, ...]:
    start = func.coalesce(Hike.actual_start_at, Hike.planned_start_at)
    return (
        (start.asc().nulls_first(), Hike.id.desc())
        if reverse
        else (start.desc().nulls_last(), Hike.id.asc())
    )


@router.get("/{hike_id}/neighbors/{locale}", response_model=HikeNeighborsRead)
def get_hike_neighbors(hike_id: UUID, locale: str, db: DatabaseSession) -> HikeNeighborsRead:
    """Adjacent translated hikes in the same stable order as the public hike listing."""
    _require_locale(db, locale)
    hike = db.get(Hike, hike_id)
    if hike is None or _translation(db, hike_id, locale) is None:
        raise HTTPException(status_code=404, detail="Hike translation not found")
    start = func.coalesce(Hike.actual_start_at, Hike.planned_start_at)
    current_start = hike.actual_start_at or hike.planned_start_at
    query = select(HikeTranslation).join(Hike).where(HikeTranslation.locale_code == locale)

    def neighbor(previous: bool) -> HikeNeighborRead | None:
        id_condition = Hike.id < hike_id if previous else Hike.id > hike_id
        if current_start is None:
            condition = and_(start.is_(None), id_condition)
            if previous:
                condition = or_(start.is_not(None), condition)
        else:
            date_condition = start > current_start if previous else start < current_start
            condition = or_(date_condition, and_(start == current_start, id_condition))
            if not previous:
                condition = or_(condition, start.is_(None))
        translation = db.scalar(query.where(condition).order_by(*_hike_order(previous)).limit(1))
        return (
            HikeNeighborRead(id=translation.hike_id, title=translation.title, slug=translation.slug)
            if translation
            else None
        )

    return HikeNeighborsRead(previous=neighbor(True), next=neighbor(False))


@router.post("", response_model=HikeRead, status_code=status.HTTP_201_CREATED)
def create_hike(payload: HikeWrite, request: Request, db: DatabaseSession) -> HikeRead:
    _validate_location(db, payload.location_id)
    hike = Hike(
        location_id=payload.location_id,
        status=payload.status,
        planned_start_at=payload.planned_start_at,
        planned_end_at=payload.planned_end_at,
        actual_start_at=payload.actual_start_at,
        actual_end_at=payload.actual_end_at,
        distance_km=payload.distance_km,
        ascent_m=payload.ascent_m,
        start_point=payload.start_point,
        end_point=payload.end_point,
    )
    db.add(hike)
    db.flush()
    english = HikeTranslation(
        hike_id=hike.id,
        locale_code=SOURCE_LOCALE,
        title=payload.english.title,
        tagline=payload.english.tagline,
        summary_markdown=payload.english.summary_markdown,
        description_markdown=payload.english.description_markdown,
        slug=unique_slug(db, SOURCE_LOCALE, payload.english.title, hike.id),
        source_revision=hike.source_revision,
        review_status=TranslationReviewStatus.SOURCE,
    )
    db.add(english)
    _set_source_label(db, hike.id, payload.english.geographic_label)
    try:
        validate_selection(db, hike.id, payload.location_id, payload.track_collection_id)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    hike.track_collection_id = payload.track_collection_id
    _replace_extra(db, hike, payload)
    _replace_cards(db, hike, payload)
    db.commit()
    db.refresh(hike)
    return _detail(db, hike, english, request)


@router.get(
    "/{hike_id}",
    response_model=HikeRead,
    responses={404: {"description": "Hike translation not found"}},
)
def get_hike(
    hike_id: UUID, request: Request, db: DatabaseSession, locale: str = SOURCE_LOCALE
) -> HikeRead:
    _require_locale(db, locale)
    hike = db.get(Hike, hike_id)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    translation = _translation(db, hike.id, locale)
    if translation is None:
        raise HTTPException(status_code=404, detail="Hike translation not found")
    return _detail(db, hike, translation, request)


@router.get(
    "/{hike_id}/cover-image",
    name="get_hike_cover_image",
    response_class=Response,
    responses={**IMAGE_RESPONSES, 307: {"description": "Cover has a newer version"}},
)
def get_hike_cover_image(
    hike_id: UUID,
    request: Request,
    db: DatabaseSession,
    variant: CoverVariant | None = None,
    v: str | None = None,
) -> Response:
    asset: HikeCoverAsset | HikeCoverImage | None = (
        db.get(HikeCoverAsset, (hike_id, variant)) if variant is not None else None
    )
    if asset is not None:
        content_type = "image/webp"
    else:
        cover = db.get(HikeCoverImage, hike_id)
        if cover is None:
            raise HTTPException(status_code=404, detail="Hike cover image not found")
        asset = cover
        content_type = cover.content_type

    if v is not None and v != asset.sha256:
        current = request.url.include_query_params(v=asset.sha256)
        return RedirectResponse(
            f"{current.path}?{current.query}", headers={"Cache-Control": "no-store"}
        )
    return image_response(
        lambda: asset.content, content_type, asset.sha256, request, immutable=v is not None
    )


@router.get(
    "/{hike_id}/maps",
    response_model=list[HikeMapRead],
    responses={404: {"description": "Hike not found"}},
)
def list_hike_maps(hike_id: UUID, request: Request, db: DatabaseSession) -> list[HikeMapRead]:
    if db.get(Hike, hike_id) is None:
        raise HTTPException(404, "Hike not found")
    # Keep binary content out of metadata queries.
    rows = db.execute(
        select(
            HikeMapImage.variant,
            HikeMapImage.width,
            HikeMapImage.height,
            HikeMapImage.sha256,
            HikeMapImage.provenance,
        )
        .where(HikeMapImage.hike_id == hike_id)
        .order_by(HikeMapImage.variant)
    )
    return [
        HikeMapRead(
            variant=row.variant,
            width=row.width,
            height=row.height,
            sha256=row.sha256,
            generated_at=row.provenance.get("generated_at"),
            url=str(request.url_for("get_hike_map", hike_id=str(hike_id), variant=row.variant)),
        )
        for row in rows
    ]


@router.get(
    "/{hike_id}/maps/{variant}",
    name="get_hike_map",
    response_class=Response,
    responses={
        200: {"content": {"image/webp": {}}, "description": "Generated WebP map"},
        304: {"description": "Image unchanged"},
        404: {"description": "Map not found"},
    },
)
def get_hike_map(hike_id: UUID, variant: str, request: Request, db: DatabaseSession) -> Response:
    image = db.get(HikeMapImage, (hike_id, variant))
    if image is None:
        raise HTTPException(404, "Hike map not found")
    return image_response(image.content, "image/webp", image.sha256, request)


@router.get(
    "/{locale}/{slug}",
    response_model=HikeRead,
    responses={
        308: {"description": "Old slug"},
        404: {"description": "Hike translation not found"},
    },
)
def get_hike_by_slug(
    locale: str, slug: str, request: Request, db: DatabaseSession
) -> HikeRead | Response:
    _require_locale(db, locale)
    translation = db.scalar(
        select(HikeTranslation).where(
            HikeTranslation.locale_code == locale, HikeTranslation.slug == slug
        )
    )
    if translation is None:
        alias = db.scalar(
            select(HikeSlugAlias).where(
                HikeSlugAlias.locale_code == locale, HikeSlugAlias.slug == slug
            )
        )
        if alias is None:
            raise HTTPException(status_code=404, detail="Hike translation not found")
        current = _translation(db, alias.hike_id, locale)
        if current is None:
            raise HTTPException(status_code=404, detail="Hike translation not found")
        return RedirectResponse(url=f"/api/hikes/{locale}/{current.slug}", status_code=308)
    hike = db.get(Hike, translation.hike_id)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    return _detail(db, hike, translation, request)


@router.put("/{hike_id}", response_model=HikeRead)
def replace_hike(
    hike_id: UUID, payload: HikeWrite, request: Request, db: DatabaseSession
) -> HikeRead:
    hike = db.get(Hike, hike_id, with_for_update=True)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    _validate_location(db, payload.location_id)
    english = _translation(db, hike.id, SOURCE_LOCALE)
    if english is None:
        raise HTTPException(status_code=409, detail="English source translation is missing")
    content_changed = (
        english.title != payload.english.title
        or english.tagline != payload.english.tagline
        or english.summary_markdown != payload.english.summary_markdown
        or english.description_markdown != payload.english.description_markdown
    )
    hike.location_id = payload.location_id
    hike.status = payload.status
    hike.planned_start_at = payload.planned_start_at
    hike.planned_end_at = payload.planned_end_at
    hike.actual_start_at = payload.actual_start_at
    hike.actual_end_at = payload.actual_end_at
    hike.distance_km = (
        Decimal(str(payload.distance_km)) if payload.distance_km is not None else None
    )
    hike.ascent_m = payload.ascent_m
    hike.start_point = payload.start_point
    hike.end_point = payload.end_point
    if "geographic_label" in payload.english.model_fields_set:
        _set_source_label(db, hike.id, payload.english.geographic_label)
    if content_changed:
        hike.source_revision += 1
        _set_translation_text(english, payload)
        _set_generated_slug(db, english, payload.english.title)
        english.source_revision = hike.source_revision
        english.review_status = TranslationReviewStatus.SOURCE
    try:
        validate_selection(db, hike.id, payload.location_id, payload.track_collection_id)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    hike.track_collection_id = payload.track_collection_id
    _replace_extra(db, hike, payload)
    _replace_cards(db, hike, payload)
    db.commit()
    db.refresh(hike)
    return _detail(db, hike, english, request)


@router.delete("/{hike_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hike(hike_id: UUID, db: DatabaseSession) -> Response:
    hike = db.get(Hike, hike_id, with_for_update=True)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    # Match the workers' lock order before deleting their jobs.
    db.get(HikeGeographicLabel, hike_id, with_for_update=True)
    db.query(TranslationJob).filter(
        TranslationJob.entity_type.in_(("hike", "hike_geographic_label")),
        TranslationJob.entity_id == hike.id,
    ).delete(synchronize_session=False)
    db.delete(hike)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/{hike_id}/cover-image",
    response_model=HikeRead,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            },
        }
    },
)
def upload_hike_cover_image(
    hike_id: UUID, content: PhotoBody, request: Request, db: DatabaseSession
) -> HikeRead:
    hike = db.get(Hike, hike_id, with_for_update=True)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    translation = _translation(db, hike.id, SOURCE_LOCALE)
    if translation is None:
        raise HTTPException(status_code=409, detail="English source translation is missing")
    variants, content_type = optimize_images(content, COVER_VARIANTS)
    cover_image = db.get(HikeCoverImage, hike.id, with_for_update=True) or HikeCoverImage(
        hike_id=hike.id
    )
    cover_image.content_type = content_type
    cover_image.content = variants.pop("image")
    cover_image.sha256 = hashlib.sha256(cover_image.content).hexdigest()
    if content_type == "image/svg+xml":
        variants.clear()
    variants["original"] = content
    for kind in cover_image.assets.keys() - variants.keys():
        del cover_image.assets[kind]
    for kind, value in variants.items():
        cover_image.set_asset(kind, value, hashlib.sha256(value).hexdigest())
    hike.cover_image = cover_image
    db.commit()
    db.refresh(hike)
    return _detail(db, hike, translation, request)


@router.delete("/{hike_id}/cover-image", status_code=status.HTTP_204_NO_CONTENT)
def delete_hike_cover_image(hike_id: UUID, db: DatabaseSession) -> Response:
    hike = db.get(Hike, hike_id, with_for_update=True)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    if hike.cover_image is not None:
        hike.cover_image = None
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{hike_id}/translations/{locale}/review", response_model=HikeLocalizedRead)
def update_translation_review(
    hike_id: UUID,
    locale: str,
    payload: TranslationReviewWrite,
    db: DatabaseSession,
) -> HikeLocalizedRead:
    if locale == SOURCE_LOCALE:
        raise HTTPException(status_code=422, detail="The English source is not a translation")
    if locale not in TARGET_LOCALES:
        raise HTTPException(status_code=404, detail="Language not found")
    db.execute(select(Hike.id).where(Hike.id == hike_id).with_for_update()).all()
    translation = _translation(db, hike_id, locale)
    if translation is None:
        raise HTTPException(status_code=404, detail="Hike translation not found")
    translation.review_status = TranslationReviewStatus(payload.review_status)
    db.commit()
    db.refresh(translation)
    return _localized(db, translation)


def _require_locale(db: Session, locale: str) -> None:
    from knut_vandrar_backend.models.reference import Language

    language = db.get(Language, locale)
    if language is None or not language.enabled:
        raise HTTPException(status_code=404, detail="Language not found")


def _validate_location(db: Session, location_id: UUID | None) -> None:
    if location_id is not None and db.get(HikingLocation, location_id) is None:
        raise HTTPException(status_code=422, detail="Trail not found")


def _translation(db: Session, hike_id: UUID, locale: str) -> HikeTranslation | None:
    return db.scalar(
        select(HikeTranslation).where(
            HikeTranslation.hike_id == hike_id,
            HikeTranslation.locale_code == locale,
        )
    )


def _detail(db: Session, hike: Hike, translation: HikeTranslation, request: Request) -> HikeRead:
    card_adapter = TypeAdapter(InfoCard)
    card_order = (
        InfoCardType.sort_order_active
        if hike.status in {HikeStatus.PLANNED, HikeStatus.ONGOING}
        else InfoCardType.sort_order_finished
    )
    ordered_cards = db.scalars(
        select(HikeInfoCard)
        .join(InfoCardType, HikeInfoCard.type == InfoCardType.type)
        .where(HikeInfoCard.hike_id == hike.id)
        .order_by(card_order, HikeInfoCard.sort_order, HikeInfoCard.id)
    )
    cards = [card_adapter.validate_python(item.data) for item in ordered_cards]
    return HikeRead(
        id=hike.id,
        track_collection_id=hike.track_collection_id,
        has_geographic_label=db.get(HikeGeographicLabel, hike.id) is not None,
        english_title=next(
            (item.title for item in hike.translations if item.locale_code == SOURCE_LOCALE), None
        ),
        location=read_location(db, hike.location, request, translation.locale_code)
        if hike.location
        else None,
        status=hike.status,
        planned_start_at=hike.planned_start_at,
        planned_end_at=hike.planned_end_at,
        actual_start_at=hike.actual_start_at,
        actual_end_at=hike.actual_end_at,
        distance_km=float(hike.distance_km) if hike.distance_km is not None else None,
        ascent_m=hike.ascent_m,
        start_point=hike.start_point,
        end_point=hike.end_point,
        duration_days=_duration_days(hike),
        cover_image_url=(
            str(request.url_for("get_hike_cover_image", hike_id=str(hike.id)))
            if hike.cover_image is not None
            else None
        ),
        cover_sources=_cover_sources(hike, request),
        translation=_localized(db, translation),
        available_translations=[
            HikeSlugRead(locale=item.locale_code, slug=item.slug)
            for item in sorted(hike.translations, key=lambda item: item.locale_code)
        ],
        cards=cards,
        achievements=[
            AchievementRead.model_validate(
                read_authored(db, "achievement", item, translation.locale_code)
            )
            for item in db.scalars(
                select(HikeAchievement)
                .where(HikeAchievement.hike_id == hike.id)
                .order_by(HikeAchievement.sort_order, HikeAchievement.id)
            )
        ],
        **_extra_read(db, hike),
        created_at=hike.created_at,
        updated_at=hike.updated_at,
    )


def _summary(
    db: Session, hike: Hike, translation: HikeTranslation, request: Request
) -> HikeSummaryRead:
    return HikeSummaryRead(
        id=hike.id,
        location=read_location(db, hike.location, request, translation.locale_code)
        if hike.location
        else None,
        status=hike.status,
        planned_start_at=hike.planned_start_at,
        planned_end_at=hike.planned_end_at,
        actual_start_at=hike.actual_start_at,
        actual_end_at=hike.actual_end_at,
        distance_km=float(hike.distance_km) if hike.distance_km is not None else None,
        ascent_m=hike.ascent_m,
        start_point=hike.start_point,
        end_point=hike.end_point,
        duration_days=_duration_days(hike),
        cover_image_url=(
            str(request.url_for("get_hike_cover_image", hike_id=str(hike.id)))
            if hike.cover_image is not None
            else None
        ),
        cover_sources=_cover_sources(hike, request),
        translation=_localized(db, translation),
    )


def _cover_sources(hike: Hike, request: Request) -> HikeCoverSources | None:
    cover = hike.cover_image
    if cover is None:
        return None
    url = request.url_for("get_hike_cover_image", hike_id=str(hike.id))
    full = str(url.include_query_params(v=cover.sha256))
    variants = {
        key: str(url.include_query_params(variant=key, v=asset.sha256))
        for key, asset in cover.assets.items()
        if key in ("mobile", "card")
    }
    return HikeCoverSources(
        full=full, mobile=variants.get("mobile", full), card=variants.get("card", full)
    )


def _localized(db: Session, translation: HikeTranslation) -> HikeLocalizedRead:
    is_outdated = translation.locale_code != SOURCE_LOCALE and (
        translation.source_revision != translation.hike.source_revision
        or translation.profile_fingerprint
        != profile_fingerprint(db, "hike", translation.locale_code)[1]
    )
    label = db.get(HikeGeographicLabelTranslation, (translation.hike_id, translation.locale_code))
    return HikeLocalizedRead(
        locale=translation.locale_code,
        title=translation.title,
        tagline=translation.tagline,
        geographic_label=label.geographic_label if label else None,
        summary_markdown=translation.summary_markdown,
        description_markdown=translation.description_markdown,
        slug=translation.slug,
        review_status=translation.review_status,
        is_outdated=is_outdated,
    )


def _duration_days(hike: Hike) -> int | None:
    if hike.status == "planned":
        start, end = hike.planned_start_at, hike.planned_end_at
    else:
        start = hike.actual_start_at
        end = hike.actual_end_at or (datetime.now(UTC) if hike.status == "ongoing" else None)
    if start is None or end is None:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    seconds = (end - start).total_seconds()
    return ceil(seconds / 86400) if seconds > 0 else 0


def _set_translation_text(translation: HikeTranslation, payload: HikeWrite) -> None:
    translation.title = payload.english.title
    translation.tagline = payload.english.tagline
    translation.summary_markdown = payload.english.summary_markdown
    translation.description_markdown = payload.english.description_markdown


def _set_generated_slug(db: Session, translation: HikeTranslation, title: str) -> None:
    new_slug = unique_slug(db, translation.locale_code, title, translation.hike_id)
    if translation.slug == new_slug:
        return
    alias = db.scalar(
        select(HikeSlugAlias).where(
            HikeSlugAlias.locale_code == translation.locale_code,
            HikeSlugAlias.slug == translation.slug,
        )
    )
    if alias is None:
        db.add(
            HikeSlugAlias(
                hike_id=translation.hike_id,
                locale_code=translation.locale_code,
                slug=translation.slug,
            )
        )
    translation.slug = new_slug


def _replace_cards(db: Session, hike: Hike, payload: HikeWrite) -> None:
    from jsonschema import Draft202012Validator
    from jsonschema.exceptions import SchemaError, ValidationError

    cards = [card.model_dump(mode="json") for card in payload.cards]
    card_type_names = {card["type"] for card in cards}
    card_types = {
        card_type.type: card_type
        for card_type in db.scalars(
            select(InfoCardType).where(InfoCardType.type.in_(card_type_names))
        ).all()
    }

    for card in cards:
        card_type = card_types.get(card["type"])
        if card_type is None:
            raise HTTPException(
                status_code=422,
                detail=f"The info card type '{card['type']}' is not registered",
            )
        try:
            Draft202012Validator.check_schema(card_type.data_structure)
            validator = Draft202012Validator(card_type.data_structure)
            validator.validate(card)
        except SchemaError as exc:
            raise RuntimeError(
                f"Invalid data structure for info card type '{card_type.type}'"
            ) from exc
        except ValidationError as exc:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Info card '{card_type.type}' does not match its data structure: {exc.message}"
                ),
            ) from exc

    hike.cards.clear()
    # Delete the previous rows before inserting replacements with the same unique type.
    db.flush()
    for index, data in enumerate(cards):
        db.add(
            HikeInfoCard(
                hike_id=hike.id,
                type=data["type"],
                sort_order=index,
                data=data,
            )
        )


EXTRA_FIELDS = (
    "stop_latitude",
    "stop_longitude",
    "stop_stage",
    "start_latitude",
    "start_longitude",
    "end_latitude",
    "end_longitude",
    "direction",
    "route_scope",
    "is_loop",
    "named_route_name",
    "named_route_url",
    "start_stage",
    "end_stage",
    "overnights_recorded_at",
)


def _replace_extra(db: Session, hike: Hike, payload: HikeWrite) -> None:
    from sqlalchemy import delete

    for key in EXTRA_FIELDS:
        value = getattr(payload, key)
        setattr(hike, key, str(value) if key == "named_route_url" and value else value)
    db.execute(delete(HikeOvernight).where(HikeOvernight.hike_id == hike.id))
    for overnight in payload.overnights:
        db.add(HikeOvernight(hike_id=hike.id, **overnight.model_dump()))


def _extra_read(db: Session, hike: Hike) -> dict[str, Any]:
    values = {key: getattr(hike, key) for key in EXTRA_FIELDS}
    recorded = hike.overnights_recorded_at
    if recorded is not None and recorded.tzinfo is None:
        values["overnights_recorded_at"] = recorded.replace(tzinfo=UTC)
    values["overnights"] = [
        {"accommodation_type": row.accommodation_type, "night_count": row.night_count}
        for row in db.scalars(select(HikeOvernight).where(HikeOvernight.hike_id == hike.id))
    ]
    return values


@router.put("/{hike_id}/translations/{locale}", response_model=HikeLocalizedRead)
def override_hike_translation(
    hike_id: UUID, locale: str, payload: HikeEnglishContent, db: DatabaseSession
) -> HikeLocalizedRead:
    _require_locale(db, locale)
    if locale == SOURCE_LOCALE:
        raise HTTPException(422, "Edit English through the source endpoint")
    hike = db.scalar(select(Hike).where(Hike.id == hike_id).with_for_update())
    if hike is None:
        raise HTTPException(404, "Hike not found")
    db.execute(select(Hike.id).where(Hike.id == hike_id).with_for_update()).all()
    translation = _translation(db, hike_id, locale)
    if translation is None:
        translation = HikeTranslation(
            hike_id=hike_id,
            locale_code=locale,
            slug=unique_slug(db, locale, payload.title, hike_id),
        )
        db.add(translation)
    for key, value in payload.model_dump(exclude={"geographic_label"}).items():
        setattr(translation, key, value)
    _set_generated_slug(db, translation, payload.title)
    translation.review_status = TranslationReviewStatus.MANUAL
    translation.source_revision = hike.source_revision
    translation.profile_fingerprint = profile_fingerprint(db, "hike", locale)[1]
    if "geographic_label" in payload.model_fields_set:
        entity = _label_for_update(db, hike.id, create=payload.geographic_label is not None)
        if entity is not None:
            set_manual(
                db,
                "hike_geographic_label",
                entity,
                locale,
                {"geographic_label": payload.geographic_label},
            )
    db.commit()
    return _localized(db, translation)


def _label_for_update(db: Session, hike_id: UUID, *, create: bool) -> HikeGeographicLabel | None:
    entity = db.get(HikeGeographicLabel, hike_id, with_for_update=True)
    if entity is None and create:
        entity = HikeGeographicLabel(id=hike_id)
        db.add(entity)
        db.flush()
        set_source(db, "hike_geographic_label", entity, {"geographic_label": None})
    return entity


def _set_source_label(db: Session, hike_id: UUID, label: str | None) -> None:
    entity = _label_for_update(db, hike_id, create=label is not None)
    if entity is not None:
        set_source(db, "hike_geographic_label", entity, {"geographic_label": label})
