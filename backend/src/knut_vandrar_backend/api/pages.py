"""Public page lookup and authenticated manual locale management."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.auth import require_admin_auth
from knut_vandrar_backend.api.schemas.page import (
    PageLocaleCode,
    PageRead,
    PageSummary,
    PageWrite,
    PublicPage,
)
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.enums import PageKey
from knut_vandrar_backend.models.page import PageDefinition, PageLocale

DatabaseSession = Annotated[Session, Depends(get_db)]
router = APIRouter(prefix="/api/pages", tags=["pages"])
admin_router = APIRouter(
    prefix="/api/page-locales", tags=["pages"], dependencies=[Depends(require_admin_auth)]
)


def read(row: PageLocale) -> PageRead:
    return PageRead.model_validate(row, from_attributes=True)


@router.get(
    "", response_model=list[PageSummary], responses={500: {"description": "Could not load pages"}}
)
def discover(db: DatabaseSession) -> list[PageSummary]:
    rows = list(
        db.execute(
            select(PageLocale.page_key, PageLocale.locale, PageLocale.indexable)
            .where(PageLocale.published.is_(True))
            .order_by(PageLocale.page_key, PageLocale.locale)
        )
    )
    locales: dict[str, list[str]] = {}
    for row in rows:
        locales.setdefault(row.page_key, []).append(row.locale)
    return [
        PageSummary.model_validate(
            dict(
                page_key=row.page_key,
                locale=row.locale,
                indexable=row.indexable,
                available_locales=locales[row.page_key],
            )
        )
        for row in rows
    ]


@router.get(
    "/{page_key}", response_model=PublicPage, responses={404: {"description": "Page not found"}}
)
def get_page(page_key: PageKey, locale: PageLocaleCode, db: DatabaseSession) -> PublicPage:
    row = db.scalar(
        select(PageLocale).where(
            PageLocale.page_key == page_key,
            PageLocale.locale == locale,
            PageLocale.published.is_(True),
        )
    )
    if row is None:
        raise HTTPException(404, "Page not found")
    locales = list(
        db.scalars(
            select(PageLocale.locale)
            .where(PageLocale.page_key == page_key, PageLocale.published.is_(True))
            .order_by(PageLocale.locale)
        )
    )
    return PublicPage.model_validate(
        dict(
            page_key=page_key,
            locale=locale,
            indexable=row.indexable,
            content=row.content,
            available_locales=locales,
        )
    )


@admin_router.get("", response_model=Page[PageRead], openapi_extra={"x-admin-only": True})
def listing(db: DatabaseSession, limit: Limit = 10, offset: Offset = 0) -> dict[str, object]:
    return dict(
        items=[
            read(row)
            for row in db.scalars(
                select(PageLocale)
                .order_by(PageLocale.page_key, PageLocale.locale)
                .limit(limit)
                .offset(offset)
            )
        ],
        total=db.scalar(select(func.count()).select_from(PageLocale)) or 0,
        limit=limit,
        offset=offset,
    )


def require(db: Session, entity_id: UUID) -> PageLocale:
    row = db.get(PageLocale, entity_id)
    if row is None:
        raise HTTPException(404, "Page locale not found")
    return row


def save(db: Session, row: PageLocale, payload: PageWrite) -> PageRead:
    definition = db.get(PageDefinition, payload.page_key)
    if definition is None or definition.template.value != payload.content.type:
        raise HTTPException(422, "Content must match the page template")
    for key, value in payload.model_dump(mode="json").items():
        setattr(row, key, value)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "This page already has content for that locale") from error
    return read(row)


@admin_router.post("", response_model=PageRead, status_code=201)
def create(payload: PageWrite, db: DatabaseSession) -> PageRead:
    return save(db, PageLocale(), payload)


@admin_router.get("/{entity_id}", response_model=PageRead, openapi_extra={"x-admin-only": True})
def detail(entity_id: UUID, db: DatabaseSession) -> PageRead:
    return read(require(db, entity_id))


@admin_router.put("/{entity_id}", response_model=PageRead)
def update(entity_id: UUID, payload: PageWrite, db: DatabaseSession) -> PageRead:
    return save(db, require(db, entity_id), payload)


@admin_router.delete("/{entity_id}", status_code=204)
def delete(entity_id: UUID, db: DatabaseSession) -> Response:
    db.delete(require(db, entity_id))
    db.commit()
    return Response(status_code=204)
