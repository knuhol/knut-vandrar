"""Stream archives without loading a gallery or archive index into memory."""

import hashlib
import re
import sqlite3
import tarfile
from collections.abc import Iterator
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryFile
from typing import BinaryIO
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from knut_vandrar_backend.media.progress import Progress
from knut_vandrar_backend.media.schema import (
    CHUNK_BYTES,
    MAX_FILE_BYTES,
    MAX_RECORD_BYTES,
    Asset,
    ImageFile,
    Manifest,
    PhotoText,
)
from knut_vandrar_backend.media.storage import PHOTO_FILES, photo_files_directory
from knut_vandrar_backend.models.hike import Hike, HikeCoverImage
from knut_vandrar_backend.models.location import HikingLocation, LocationLogo
from knut_vandrar_backend.models.photo import Photo, PhotoTranslation

FILE_PATH = re.compile(
    rf"(?:photo/[0-9a-f-]{{36}}/(?:{'|'.join(PHOTO_FILES)})"
    r"|(?:cover|logo)/[0-9a-f-]{36}/image)\Z"
)


class MediaError(ValueError):
    """An archive or destination could not be safely transferred."""


def schema_revision(db: Session) -> str:
    revisions = list(db.scalars(text("SELECT version_num FROM alembic_version")))
    if len(revisions) != 1:
        raise MediaError("Media transfers require a database with one Alembic revision")
    return str(revisions[0])


def file_info(path: Path) -> ImageFile:
    if path.is_symlink() or not path.is_file():
        raise MediaError(f"Missing or unsafe image file: {path.name}")
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        while chunk := source.read(CHUNK_BYTES):
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise MediaError(f"Image exceeds {MAX_FILE_BYTES} bytes")
            digest.update(chunk)
    return ImageFile(sha256=digest.hexdigest(), size=size)


def _add_bytes(archive: tarfile.TarFile, name: str, value: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.mode = 0o600
    info.size = len(value)
    archive.addfile(info, BytesIO(value))


def _add_path(archive: tarfile.TarFile, name: str, path: Path, size: int) -> None:
    info = tarfile.TarInfo(name)
    info.mode = 0o600
    info.size = size
    with path.open("rb") as source:
        archive.addfile(info, source)


def photo_texts(db: Session, photo_id: UUID) -> list[PhotoText]:
    return [
        PhotoText(**{name: getattr(row, name) for name in PhotoText.model_fields})
        for row in db.scalars(
            select(PhotoTranslation)
            .where(PhotoTranslation.photo_id == photo_id)
            .order_by(PhotoTranslation.locale_code)
        )
    ]


def export_archive(
    db: Session,
    media_root: Path,
    output: BinaryIO,
    *,
    hikes: tuple[UUID, ...] = (),
    locations: tuple[UUID, ...] = (),
    progress: Progress | None = None,
) -> int:
    progress = progress or Progress()
    progress.report("Exporting images and metadata...")
    # Snapshot all SQL data; shared row locks keep API deletes from removing photo files.
    if db.get_bind().dialect.name == "postgresql":
        db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    manifest = Manifest(schema_revision=schema_revision(db))
    for model, identifiers in ((Hike, hikes), (HikingLocation, locations)):
        for identifier in identifiers:
            if db.get(model, identifier) is None:
                raise MediaError(f"Unknown {model.__tablename__} ID: {identifier}")
    selected = select(Hike)
    if hikes or locations:
        selected = selected.where(Hike.id.in_(hikes) | Hike.location_id.in_(locations))
    count = 0
    with (
        TemporaryFile() as records,
        tarfile.open(fileobj=output, mode="w|", format=tarfile.USTAR_FORMAT) as archive,
    ):
        _add_bytes(archive, "manifest.json", manifest.model_dump_json().encode())

        def write_asset(asset: Asset) -> None:
            nonlocal count
            value = asset.model_dump_json().encode() + b"\n"
            if len(value) > MAX_RECORD_BYTES:
                raise MediaError("Image metadata exceeds the archive record limit")
            records.write(value)
            count += 1
            progress.report(f"Exported {count} images...", force=False)

        for hike in db.scalars(
            selected.order_by(Hike.id).with_for_update(read=True).execution_options(yield_per=100)
        ):
            cover = db.get(HikeCoverImage, hike.id)
            if cover is not None:
                digest = hashlib.sha256(cover.content).hexdigest()
                if digest != cover.sha256:
                    raise MediaError(f"Cover checksum mismatch: {hike.id}")
                asset = Asset(
                    kind="cover",
                    id=hike.id,
                    owner_id=hike.id,
                    content_type=cover.content_type,
                    files={"image": ImageFile(sha256=digest, size=len(cover.content))},
                )
                _add_bytes(archive, asset.file_path("image"), cover.content)
                write_asset(asset)
            photos = (
                select(Photo).where(Photo.hike_id == hike.id).order_by(Photo.sort_order, Photo.id)
            )
            for photo in db.scalars(
                photos.with_for_update(read=True).execution_options(yield_per=100)
            ):
                directory = photo_files_directory(media_root, photo.id, photo.digest)
                files = {variant: file_info(directory / variant) for variant in PHOTO_FILES}
                if files["original"].sha256 != photo.digest:
                    raise MediaError(f"Original checksum mismatch: {photo.id}")
                asset = Asset(
                    kind="photo",
                    id=photo.id,
                    owner_id=hike.id,
                    content_type=photo.original_type,
                    files=files,
                    sort_order=photo.sort_order,
                    source_revision=photo.source_revision,
                    width=photo.width,
                    height=photo.height,
                    translations=photo_texts(db, photo.id),
                )
                for variant, info in files.items():
                    _add_path(archive, asset.file_path(variant), directory / variant, info.size)
                    if file_info(directory / variant) != info:
                        raise MediaError(f"Photo changed during export: {photo.id}")
                write_asset(asset)

        logos = select(LocationLogo)
        if hikes or locations:
            selected_locations = selected.with_only_columns(Hike.location_id)
            logos = logos.where(
                LocationLogo.location_id.in_(locations)
                | LocationLogo.location_id.in_(selected_locations)
            )
        for logo in db.scalars(
            logos.order_by(LocationLogo.location_id).execution_options(yield_per=100)
        ):
            digest = hashlib.sha256(logo.content).hexdigest()
            if digest != logo.sha256:
                raise MediaError(f"Logo checksum mismatch: {logo.location_id}")
            asset = Asset(
                kind="logo",
                id=logo.location_id,
                owner_id=logo.location_id,
                content_type=logo.content_type,
                files={"image": ImageFile(sha256=digest, size=len(logo.content))},
            )
            _add_bytes(archive, asset.file_path("image"), logo.content)
            write_asset(asset)
        record_info = tarfile.TarInfo("assets.jsonl")
        record_info.mode = 0o600
        record_info.size = records.tell()
        records.seek(0)
        archive.addfile(record_info, records)
    progress.report(f"Archive complete: {count} images.")
    return count


def read_assets(index: sqlite3.Connection) -> Iterator[Asset]:
    for (value,) in index.execute("SELECT data FROM assets ORDER BY owner, sort_order, id"):
        yield Asset.model_validate_json(value)


def _read_exact(source: BinaryIO, size: int) -> bytes:
    chunks = bytearray()
    while len(chunks) < size:
        chunk = source.read(size - len(chunks))
        if not chunk:
            raise MediaError("Truncated media archive")
        chunks.extend(chunk)
    return bytes(chunks)


def unpack_archive(
    source: BinaryIO, directory: Path, max_bytes: int, progress: Progress | None = None
) -> Manifest:
    """Read bounded USTAR members directly, rejecting extended headers before parsing them.

    Generic tar readers can buffer arbitrarily large PAX/long-name headers. This format
    needs only short, regular paths, so accept exactly those without extractall().
    """
    progress = progress or Progress()
    received = 0
    total = 0
    manifest: Manifest | None = None
    while True:
        header = _read_exact(source, tarfile.BLOCKSIZE)
        if header == bytes(tarfile.BLOCKSIZE):
            if _read_exact(source, tarfile.BLOCKSIZE) != bytes(tarfile.BLOCKSIZE):
                raise MediaError("Invalid archive end marker")
            break
        member = tarfile.TarInfo.frombuf(header, "utf-8", "strict")
        if member.type not in (tarfile.REGTYPE, tarfile.AREGTYPE) or member.size < 0:
            raise MediaError("Archive contains a non-regular or extended member")
        name = member.name
        if name not in {"manifest.json", "assets.jsonl"} and not FILE_PATH.fullmatch(name):
            raise MediaError(f"Unsupported archive path: {name[:100]}")
        if manifest is None and name != "manifest.json":
            raise MediaError("Archive must begin with manifest.json")
        limit = max_bytes if name == "assets.jsonl" else MAX_FILE_BYTES
        if member.size > limit or (name == "manifest.json" and member.size > MAX_RECORD_BYTES):
            raise MediaError("Archive member exceeds its size limit")
        total += member.size + tarfile.BLOCKSIZE
        if total > max_bytes:
            raise MediaError("Archive exceeds --max-bytes")
        target = directory / name
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            with target.open("xb") as destination:
                remaining = member.size
                while remaining:
                    chunk = _read_exact(source, min(remaining, CHUNK_BYTES))
                    destination.write(chunk)
                    received += len(chunk)
                    progress.report(
                        f"Received and extracted {received / 1024**2:.1f} MiB...", force=False
                    )
                    remaining -= len(chunk)
        except FileExistsError as error:
            raise MediaError(f"Duplicate archive member: {name}") from error
        padding = -member.size % tarfile.BLOCKSIZE
        if padding:
            _read_exact(source, padding)
        if name == "manifest.json":
            manifest = Manifest.model_validate_json(target.read_bytes())
    if manifest is None or not (directory / "assets.jsonl").is_file():
        raise MediaError("Archive is missing its manifest or metadata index")
    progress.report(f"Archive received: {received / 1024**2:.1f} MiB.")
    return manifest


def index_archive(
    directory: Path, index: sqlite3.Connection, progress: Progress | None = None
) -> None:
    progress = progress or Progress()
    index.execute(
        "CREATE TABLE assets (kind TEXT, id TEXT, owner TEXT, sort_order INTEGER, "
        "data TEXT, action TEXT, target TEXT, PRIMARY KEY(kind, id), UNIQUE(kind, target))"
    )
    expected_files = 0
    with (directory / "assets.jsonl").open("rb") as records:
        while value := records.readline(MAX_RECORD_BYTES + 1):
            if len(value) > MAX_RECORD_BYTES or not value.endswith(b"\n"):
                raise MediaError("Invalid or oversized image metadata record")
            asset = Asset.model_validate_json(value)
            for variant, expected in asset.files.items():
                path = directory / asset.file_path(variant)
                if file_info(path) != expected:
                    raise MediaError(
                        f"Image checksum/size mismatch: {asset.kind}/{asset.id}/{variant}"
                    )
                expected_files += 1
                progress.report(f"Verified {expected_files} file checksums...", force=False)
            try:
                index.execute(
                    "INSERT INTO assets VALUES (?, ?, ?, ?, ?, NULL, NULL)",
                    (
                        asset.kind,
                        str(asset.id),
                        str(asset.owner_id),
                        asset.sort_order,
                        asset.model_dump_json(),
                    ),
                )
            except sqlite3.IntegrityError as error:
                raise MediaError(f"Duplicate image record: {asset.id}") from error
    actual_files = sum(
        1
        for kind in ("photo", "cover", "logo")
        for path in (directory / kind).glob("*/*")
        if path.is_file()
    )
    if actual_files != expected_files:
        raise MediaError("Archive contains image files with no metadata record")
    index.commit()
