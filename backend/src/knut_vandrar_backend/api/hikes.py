"""Public CRUD routes for hikes and localized reading."""

import hashlib
from datetime import UTC, datetime
from math import ceil
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import TypeAdapter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.image_uploads import (
    IMAGE_RESPONSES,
    ImageBody,
    image_response,
    optimize_image,
)
from knut_vandrar_backend.api.schemas.hike import (
    HikeLocalizedRead,
    HikeRead,
    HikeSummaryRead,
    HikeWrite,
    InfoCard,
    TranslationReviewWrite,
)
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.api.schemas.trail import TrailRead
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import (
    Hike,
    HikeCoverImage,
    HikeInfoCard,
    HikeSlugAlias,
    HikeTranslation,
)
from knut_vandrar_backend.models.reference import InfoCardType
from knut_vandrar_backend.models.trail import Trail
from knut_vandrar_backend.models.translation import TranslationJob
from knut_vandrar_backend.translations.core import (
    SOURCE_LOCALE,
    TARGET_LOCALES,
    enqueue_translation,
    profile_fingerprint,
    unique_slug,
)

router = APIRouter(prefix="/api/hikes", tags=["hikes"])
DatabaseSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=Page[HikeSummaryRead])
def list_hikes(
    request: Request,
    db: DatabaseSession,
    locale: str = SOURCE_LOCALE,
    limit: Limit = 10,
    offset: Offset = 0,
) -> Page[HikeSummaryRead]:
    _require_locale(db, locale)
    query = select(HikeTranslation).join(Hike).where(HikeTranslation.locale_code == locale)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    translations = db.scalars(
        query.order_by(
            func.coalesce(Hike.actual_start_at, Hike.planned_start_at).desc().nulls_last(),
            Hike.id,
        )
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


@router.post("", response_model=HikeRead, status_code=status.HTTP_201_CREATED)
def create_hike(payload: HikeWrite, request: Request, db: DatabaseSession) -> HikeRead:
    _validate_trail(db, payload.trail_id)
    hike = Hike(
        trail_id=payload.trail_id,
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
    _replace_cards(db, hike, payload)
    for locale in TARGET_LOCALES:
        enqueue_translation(db, hike, locale, "source_changed")
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
    responses=IMAGE_RESPONSES,
)
def get_hike_cover_image(hike_id: UUID, request: Request, db: DatabaseSession) -> Response:
    hike = db.get(Hike, hike_id)
    if hike is None or hike.cover_image is None:
        raise HTTPException(status_code=404, detail="Hike cover image not found")
    return image_response(
        hike.cover_image.content,
        hike.cover_image.content_type,
        hike.cover_image.sha256,
        request,
    )


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
    hike = db.get(Hike, hike_id)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    _validate_trail(db, payload.trail_id)
    english = _translation(db, hike.id, SOURCE_LOCALE)
    if english is None:
        raise HTTPException(status_code=409, detail="English source translation is missing")
    content_changed = (
        english.title != payload.english.title
        or english.tagline != payload.english.tagline
        or english.summary_markdown != payload.english.summary_markdown
        or english.description_markdown != payload.english.description_markdown
    )
    hike.trail_id = payload.trail_id
    hike.status = payload.status
    hike.planned_start_at = payload.planned_start_at
    hike.planned_end_at = payload.planned_end_at
    hike.actual_start_at = payload.actual_start_at
    hike.actual_end_at = payload.actual_end_at
    hike.distance_km = payload.distance_km
    hike.ascent_m = payload.ascent_m
    hike.start_point = payload.start_point
    hike.end_point = payload.end_point
    if content_changed:
        hike.source_revision += 1
        _set_translation_text(english, payload)
        _set_generated_slug(db, english, payload.english.title)
        english.source_revision = hike.source_revision
        english.review_status = TranslationReviewStatus.SOURCE
        for locale in TARGET_LOCALES:
            enqueue_translation(db, hike, locale, "source_changed")
    _replace_cards(db, hike, payload)
    db.commit()
    db.refresh(hike)
    return _detail(db, hike, english, request)


@router.delete("/{hike_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hike(hike_id: UUID, db: DatabaseSession) -> Response:
    hike = db.get(Hike, hike_id)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    db.query(TranslationJob).filter(
        TranslationJob.entity_type == "hike", TranslationJob.entity_id == hike.id
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
    hike_id: UUID, content: ImageBody, request: Request, db: DatabaseSession
) -> HikeRead:
    hike = db.get(Hike, hike_id)
    if hike is None:
        raise HTTPException(status_code=404, detail="Hike not found")
    translation = _translation(db, hike.id, SOURCE_LOCALE)
    if translation is None:
        raise HTTPException(status_code=409, detail="English source translation is missing")
    cover_image = hike.cover_image or HikeCoverImage(hike_id=hike.id)
    content, content_type = optimize_image(content, max_dimension=1920)
    cover_image.content_type = content_type
    cover_image.content = content
    cover_image.sha256 = hashlib.sha256(content).hexdigest()
    hike.cover_image = cover_image
    db.commit()
    db.refresh(hike)
    return _detail(db, hike, translation, request)


@router.delete("/{hike_id}/cover-image", status_code=status.HTTP_204_NO_CONTENT)
def delete_hike_cover_image(hike_id: UUID, db: DatabaseSession) -> Response:
    hike = db.get(Hike, hike_id)
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


def _validate_trail(db: Session, trail_id: UUID | None) -> None:
    if trail_id is not None and db.get(Trail, trail_id) is None:
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
    cards = [card_adapter.validate_python(item.data) for item in hike.cards]
    return HikeRead(
        id=hike.id,
        trail=_trail_read(hike.trail, request),
        status=hike.status,
        planned_start_at=hike.planned_start_at,
        planned_end_at=hike.planned_end_at,
        actual_start_at=hike.actual_start_at,
        actual_end_at=hike.actual_end_at,
        distance_km=hike.distance_km,
        ascent_m=hike.ascent_m,
        start_point=hike.start_point,
        end_point=hike.end_point,
        duration_days=_duration_days(hike),
        cover_image_url=(
            str(request.url_for("get_hike_cover_image", hike_id=str(hike.id)))
            if hike.cover_image is not None
            else None
        ),
        translation=_localized(db, translation),
        cards=cards,
        created_at=hike.created_at,
        updated_at=hike.updated_at,
    )


def _summary(
    db: Session, hike: Hike, translation: HikeTranslation, request: Request
) -> HikeSummaryRead:
    return HikeSummaryRead(
        id=hike.id,
        trail=_trail_read(hike.trail, request),
        status=hike.status,
        planned_start_at=hike.planned_start_at,
        planned_end_at=hike.planned_end_at,
        actual_start_at=hike.actual_start_at,
        actual_end_at=hike.actual_end_at,
        distance_km=hike.distance_km,
        ascent_m=hike.ascent_m,
        start_point=hike.start_point,
        end_point=hike.end_point,
        duration_days=_duration_days(hike),
        cover_image_url=(
            str(request.url_for("get_hike_cover_image", hike_id=str(hike.id)))
            if hike.cover_image is not None
            else None
        ),
        translation=_localized(db, translation),
    )


def _trail_read(trail: Trail | None, request: Request) -> TrailRead | None:
    if trail is None:
        return None
    return TrailRead(
        id=trail.id,
        name=trail.name,
        type=trail.type,
        country_codes=sorted(country.country_code for country in trail.countries),
        official_url=trail.official_url,
        logo_url=(
            str(request.url_for("get_trail_logo", trail_id=str(trail.id)))
            if trail.logo is not None
            else None
        ),
    )


def _localized(db: Session, translation: HikeTranslation) -> HikeLocalizedRead:
    is_outdated = translation.locale_code != SOURCE_LOCALE and (
        translation.source_revision != translation.hike.source_revision
        or translation.profile_fingerprint
        != profile_fingerprint(db, "hike", translation.locale_code)[1]
    )
    return HikeLocalizedRead(
        locale=translation.locale_code,
        title=translation.title,
        tagline=translation.tagline,
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
    for index, data in enumerate(cards):
        db.add(
            HikeInfoCard(
                hike_id=hike.id,
                type=data["type"],
                sort_order=index,
                data=data,
            )
        )
