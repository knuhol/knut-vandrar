"""Hike gallery uploads, localized metadata and bounded paginated delivery."""

import hashlib
import logging
import shutil
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.api.auth import require_admin_auth
from knut_vandrar_backend.api.image_uploads import PhotoBody, optimize_image
from knut_vandrar_backend.api.schemas.pagination import Limit, Offset, Page
from knut_vandrar_backend.api.schemas.photo import PhotoOrder, PhotoRead, PhotoWrite
from knut_vandrar_backend.database.dependencies import get_db
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.photo import Photo, PhotoTranslation
from knut_vandrar_backend.settings import settings
from knut_vandrar_backend.translations.content import set_source
from knut_vandrar_backend.translations.core import profile_fingerprint

router = APIRouter(prefix="/api", tags=["photos"])
DatabaseSession = Annotated[Session, Depends(get_db)]
VARIANTS = {"thumbnail": 640, "fullscreen": 2560}
logger = logging.getLogger(__name__)


def photo_directory(photo_id: UUID) -> Path:
    return settings.media_root / "photos" / str(photo_id)


def read_photos(db: Session, photos: list[Photo], locale: str) -> list[dict[str, Any]]:
    if not photos:
        return []
    translations = db.scalars(
        select(PhotoTranslation).where(
            PhotoTranslation.photo_id.in_([photo.id for photo in photos]),
            PhotoTranslation.locale_code.in_({"en", locale}),
        )
    ).all()
    texts = {(text.photo_id, text.locale_code): text for text in translations}
    fingerprint = (
        profile_fingerprint(db, "photo", locale)[1]
        if locale != "en" and any(text.locale_code == locale for text in translations)
        else None
    )
    result = []
    for photo in photos:
        text = texts.get((photo.id, locale)) or texts.get((photo.id, "en"))
        if text is None:
            raise HTTPException(409, "English photo source is missing")
        metadata = dict(
            locale=text.locale_code,
            review_status=text.review_status,
            is_outdated=text.locale_code != "en"
            and (
                text.source_revision != photo.source_revision
                or text.profile_fingerprint != fingerprint
            ),
        )
        base = f"/api/photos/{photo.id}/images"
        result.append(
            dict(
                id=photo.id,
                hike_id=photo.hike_id,
                sort_order=photo.sort_order,
                width=photo.width,
                height=photo.height,
                alt=text.alt,
                caption=text.caption,
                thumbnail_url=f"{base}/thumbnail/{photo.digest}",
                image_url=f"{base}/fullscreen/{photo.digest}",
                translation=metadata,
            )
        )
    return result


def read_photo(db: Session, photo: Photo, locale: str) -> dict[str, Any]:
    return read_photos(db, [photo], locale)[0]


def require_photo(db: Session, photo_id: UUID) -> Photo:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(404, "Photo not found")
    return photo


def lock_hike(db: Session, hike_id: UUID) -> None:
    if db.scalar(select(Hike).where(Hike.id == hike_id).with_for_update()) is None:
        raise HTTPException(404, "Hike not found")


@router.get("/hikes/{hike_id}/photos", response_model=Page[PhotoRead])
def list_photos(
    hike_id: UUID,
    db: DatabaseSession,
    locale: Literal["en", "sv", "cs"] = "en",
    limit: Limit = 24,
    offset: Offset = 0,
) -> Any:
    if db.get(Hike, hike_id) is None:
        raise HTTPException(404, "Hike not found")
    query = select(Photo).where(Photo.hike_id == hike_id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(Photo.sort_order, Photo.id).limit(limit).offset(offset))
    return dict(
        items=read_photos(db, list(rows), locale),
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/hikes/{hike_id}/photos",
    response_model=PhotoRead,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            },
        }
    },
)
def upload_photo(hike_id: UUID, content: PhotoBody, db: DatabaseSession) -> Any:
    # Decode/validate and generate all derivatives before publishing any metadata.
    variants = {
        name: optimize_image(content, max_dimension=size, allow_heif=True)[0]
        for name, size in VARIANTS.items()
    }
    with Image.open(BytesIO(content)) as source:
        original_type = (
            "image/jpeg"
            if source.format == "MPO"
            else Image.MIME.get(source.format or "", "image/heic")
        )
    with Image.open(BytesIO(variants["fullscreen"])) as image:
        width, height = image.size
    lock_hike(db, hike_id)
    order = db.scalar(select(func.max(Photo.sort_order)).where(Photo.hike_id == hike_id))
    photo = Photo(
        id=uuid4(),
        hike_id=hike_id,
        sort_order=0 if order is None else order + 1,
        width=width,
        height=height,
        original_type=original_type,
        digest=hashlib.sha256(content).hexdigest(),
    )
    directory = photo_directory(photo.id)
    try:
        directory.mkdir(parents=True, mode=0o700)
        (directory / "original").write_bytes(content)
        for name, value in variants.items():
            (directory / name).write_bytes(value)
        db.add(photo)
        db.flush()
        set_source(db, "photo", photo, {"alt": "", "caption": None})
        db.commit()
    except Exception:
        db.rollback()
        shutil.rmtree(directory, ignore_errors=True)
        raise
    return read_photo(db, photo, "en")


@router.get("/photos/{photo_id}", response_model=PhotoRead)
def get_photo(photo_id: UUID, db: DatabaseSession, locale: Literal["en", "sv", "cs"] = "en") -> Any:
    return read_photo(db, require_photo(db, photo_id), locale)


@router.put("/photos/{photo_id}", response_model=PhotoRead)
def update_photo(photo_id: UUID, payload: PhotoWrite, db: DatabaseSession) -> Any:
    photo = require_photo(db, photo_id)
    lock_hike(db, photo.hike_id)
    db.refresh(photo)
    set_source(db, "photo", photo, payload.english.model_dump())
    db.commit()
    return read_photo(db, photo, "en")


@router.put("/hikes/{hike_id}/photos/order", status_code=204)
def reorder_photos(hike_id: UUID, payload: PhotoOrder, db: DatabaseSession) -> Response:
    lock_hike(db, hike_id)
    photos = list(db.scalars(select(Photo).where(Photo.hike_id == hike_id)))
    if len(set(payload.ids)) != len(payload.ids) or set(payload.ids) != {
        photo.id for photo in photos
    }:
        raise HTTPException(422, "Order must contain every photo from this hike exactly once")
    positions = {photo_id: index for index, photo_id in enumerate(payload.ids)}
    for photo in photos:
        photo.sort_order = positions[photo.id]
    db.commit()
    return Response(status_code=204)


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: UUID, db: DatabaseSession) -> Response:
    photo = require_photo(db, photo_id)
    lock_hike(db, photo.hike_id)
    db.delete(photo)
    db.commit()
    return Response(status_code=204)


@router.get("/photos/{photo_id}/images/{variant}/{digest}", response_class=FileResponse)
def get_image(
    photo_id: UUID, variant: Literal["thumbnail", "fullscreen"], digest: str, db: DatabaseSession
) -> FileResponse:
    photo = require_photo(db, photo_id)
    path = photo_directory(photo.id) / variant
    if digest != photo.digest or not path.is_file():
        raise HTTPException(404, "Image not found")
    return FileResponse(
        path,
        media_type="image/webp",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get(
    "/photos/{photo_id}/original",
    response_class=FileResponse,
    dependencies=[Depends(require_admin_auth)],
    openapi_extra={"x-admin-only": True},
)
def get_original(photo_id: UUID, db: DatabaseSession) -> FileResponse:
    photo = require_photo(db, photo_id)
    path = photo_directory(photo.id) / "original"
    if not path.is_file():
        raise HTTPException(404, "Original not found")
    extension = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/heif": ".heif",
        "image/heic": ".heic",
        "image/gif": ".gif",
    }.get(photo.original_type, "")
    return FileResponse(
        path,
        media_type=photo.original_type,
        filename=f"{photo.id}{extension}",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@event.listens_for(Session, "after_flush")
def collect_deleted_files(db: Session, _: Any) -> None:
    paths = db.info.setdefault("deleted_photo_paths", set())
    for entity in db.deleted:
        if isinstance(entity, Photo):
            paths.add(photo_directory(entity.id))


@event.listens_for(Session, "after_commit")
def delete_committed_files(db: Session) -> None:
    for path in db.info.pop("deleted_photo_paths", set()):
        try:
            shutil.rmtree(path)
        except FileNotFoundError:
            pass
        except OSError:
            logger.exception("Could not remove photo directory %s", path)


@event.listens_for(Session, "after_rollback")
def keep_rolled_back_files(db: Session) -> None:
    db.info.pop("deleted_photo_paths", None)


@router.get("/photos", response_model=Page[PhotoRead])
def all_photos(db: DatabaseSession, limit: Limit = 24, offset: Offset = 0) -> Any:
    total = db.scalar(select(func.count()).select_from(Photo)) or 0
    rows = db.scalars(
        select(Photo).order_by(Photo.created_at.desc(), Photo.id).limit(limit).offset(offset)
    )
    return dict(
        items=read_photos(db, list(rows), "en"),
        total=total,
        limit=limit,
        offset=offset,
    )
