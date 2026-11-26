"""Validate, plan, and apply idempotent media imports."""

import hashlib
import os
import shutil
import sqlite3
import warnings
from collections import Counter
from contextlib import closing
from dataclasses import dataclass, field
from datetime import UTC
from pathlib import Path
from typing import BinaryIO
from uuid import UUID, uuid4

from PIL import Image
from pillow_heif import register_heif_opener
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.api.image_uploads import detect_image_type
from knut_vandrar_backend.media.archive import (
    MediaError,
    file_info,
    index_archive,
    photo_texts,
    read_assets,
    schema_revision,
    unpack_archive,
)
from knut_vandrar_backend.media.covers import COVER_DERIVATIVE_TYPES
from knut_vandrar_backend.media.progress import Progress
from knut_vandrar_backend.media.recovery import (
    publish_photo,
    recover_transfers,
    sync_directory,
    transfer_lock,
)
from knut_vandrar_backend.media.schema import DEFAULT_MAX_BYTES, Asset, PhotoText
from knut_vandrar_backend.media.storage import photo_files_directory
from knut_vandrar_backend.models.hike import Hike, HikeCoverImage
from knut_vandrar_backend.models.location import HikingLocation, LocationLogo
from knut_vandrar_backend.models.media import MediaImportReceipt
from knut_vandrar_backend.models.photo import Photo, PhotoTranslation
from knut_vandrar_backend.models.reference import Language
from knut_vandrar_backend.models.translation import TranslationJob


@dataclass
class ImportReport:
    counts: Counter[str] = field(default_factory=Counter)
    conflicts: list[str] = field(default_factory=list)

    def conflict(self, message: str) -> None:
        self.counts["conflict"] += 1
        if len(self.conflicts) < 100:
            self.conflicts.append(message)


def _validate_images(asset: Asset, staging: Path) -> None:
    if asset.kind in {"collection", "track_selection"}:
        return
    if asset.kind == "gpx":
        from knut_vandrar_backend.tracks.gpx import normalize

        try:
            normalize((staging / asset.file_path("track")).read_bytes(), "Validation")
        except (ValueError, KeyError) as error:
            raise MediaError(f"Invalid GPX: {asset.id}") from error
        return
    register_heif_opener()
    for variant in asset.files:
        path = staging / asset.file_path(variant)
        if asset.kind != "photo":
            content_type = detect_image_type(path.read_bytes())
            is_cover_original = asset.kind == "cover" and variant == "original"
            expected_type = (
                COVER_DERIVATIVE_TYPES.get(variant, asset.content_type)
                if asset.kind == "cover"
                else asset.content_type
            )
            if content_type != expected_type and not (
                is_cover_original
                and asset.content_type == "image/webp"
                and content_type != "image/svg+xml"
            ):
                raise MediaError(f"Content type mismatch: {asset.kind}/{asset.id}")
            if content_type == "image/svg+xml":
                continue
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                if image.width * image.height > 40_000_000:
                    raise MediaError(f"Image exceeds 40 megapixels: {asset.id}")
                if getattr(image, "is_animated", False) and image.format != "MPO":
                    raise MediaError(f"Animated images are unsupported: {asset.id}")
                if asset.kind == "photo":
                    if variant == "original":
                        content_type = (
                            "image/jpeg"
                            if image.format == "MPO"
                            else Image.MIME.get(image.format or "", "image/heic")
                        )
                        if content_type != asset.content_type and not (
                            content_type in {"image/heic", "image/heif"}
                            and asset.content_type in {"image/heic", "image/heif"}
                        ):
                            raise MediaError(f"Original content type mismatch: {asset.id}")
                    elif image.format != "WEBP":
                        raise MediaError(f"Photo derivatives must be WebP: {asset.id}")
                    if variant == "fullscreen" and image.size != (asset.width, asset.height):
                        raise MediaError(f"Photo dimensions mismatch: {asset.id}")
                image.load()


def _remap(
    index: sqlite3.Connection, hike_map: dict[UUID, UUID], location_map: dict[UUID, UUID]
) -> None:
    # Keep the archive's source ordering while sorting locks by destination owner.
    for row_id, value in index.execute("SELECT rowid, data FROM assets ORDER BY rowid"):
        asset = Asset.model_validate_json(value)
        mapping = (
            location_map
            if asset.kind == "logo"
            or (asset.kind in {"collection", "gpx"} and asset.track_owner == "trail")
            else hike_map
        )
        owner = mapping.get(asset.owner_id, asset.owner_id)
        target = asset.id if asset.kind in {"photo", "collection", "gpx"} else owner
        mapped = asset.model_copy(update={"owner_id": owner, "id": target})
        if mapped.kind == "collection" and mapped.track_owner == "hike":
            mapped.track_data = {**mapped.track_data, "direction": None}
        try:
            index.execute(
                "UPDATE assets SET data=?, owner=?, target=? WHERE rowid=?",
                (mapped.model_dump_json(), str(owner), str(target), row_id),
            )
        except sqlite3.IntegrityError as error:
            raise MediaError(
                "Multiple archive entries map to the same destination image"
            ) from error
    index.commit()


def _lock_owners(db: Session, index: sqlite3.Connection) -> None:
    for condition, model in (
        (
            "kind IN ('cover', 'photo', 'track_selection') OR (kind IN ('collection', 'gpx') AND json_extract(data, '$.track_owner')='hike')",
            Hike,
        ),
        (
            "kind='logo' OR (kind IN ('collection', 'gpx') AND json_extract(data, '$.track_owner')='trail')",
            HikingLocation,
        ),
    ):
        for (owner,) in index.execute(
            f"SELECT DISTINCT owner FROM assets WHERE {condition} ORDER BY owner"
        ):
            if db.scalar(select(model.id).where(model.id == UUID(owner)).with_for_update()) is None:
                raise MediaError(
                    f"Missing destination {model.__tablename__} ID: {owner}; use a mapping"
                )


def _text_comparison(text: PhotoText, source_revision: int) -> dict[str, object]:
    value = text.model_dump(mode="json")
    value["source_revision"] = text.source_revision - source_revision
    if text.generated_at is not None:
        generated = text.generated_at
        if generated.tzinfo is None:
            generated = generated.replace(tzinfo=UTC)
        value["generated_at"] = generated.astimezone(UTC).isoformat()
    return value


def _photo_matches(db: Session, photo: Photo, asset: Asset) -> bool:
    if (photo.digest, photo.original_type, photo.width, photo.height) != (
        asset.files["original"].sha256,
        asset.content_type,
        asset.width,
        asset.height,
    ):
        return False
    existing = {text.locale_code: text for text in photo_texts(db, photo.id)}
    return all(
        text.locale_code in existing
        and _text_comparison(existing[text.locale_code], photo.source_revision)
        == _text_comparison(text, asset.source_revision)
        for text in asset.translations
    )


def _safe_directory(media_root: Path, photo_id: UUID, digest: str) -> Path:
    base = media_root / "photos" / str(photo_id)
    for directory in (base, base / "versions", base / "versions" / digest):
        if directory.is_symlink() or (directory.exists() and not directory.is_dir()):
            raise MediaError(f"Unsafe destination photo directory: {photo_id}")
    return photo_files_directory(media_root, photo_id, digest)


def _database_image(db: Session, kind: str, owner: UUID) -> LocationLogo | HikeCoverImage | None:
    if kind == "logo":
        return db.scalar(
            select(LocationLogo).where(LocationLogo.location_id == owner).with_for_update()
        )
    return db.scalar(
        select(HikeCoverImage).where(HikeCoverImage.hike_id == owner).with_for_update()
    )


def _plan(
    db: Session, index: sqlite3.Connection, media_root: Path, replace: bool, progress: Progress
) -> ImportReport:
    report = ImportReport()
    locales = set(db.scalars(select(Language.code)))
    for row_id, value in index.execute(
        "SELECT rowid, data FROM assets ORDER BY owner, sort_order, id"
    ):
        asset = Asset.model_validate_json(value)
        action = "add"
        if asset.kind == "track_selection":
            from knut_vandrar_backend.tracks.selection import validate_selection

            hike = db.get(Hike, asset.owner_id)
            if hike is None:
                raise MediaError("Missing destination hike for collection selection")
            collection_id = UUID(asset.track_data["collection_id"])
            incoming = index.execute(
                "SELECT data FROM assets WHERE kind='collection' AND target=?",
                (str(collection_id),),
            ).fetchone()
            if incoming:
                collection_asset = Asset.model_validate_json(incoming[0])
                matches = (
                    collection_asset.track_owner == "hike" and collection_asset.owner_id == hike.id
                ) or (
                    collection_asset.track_owner == "trail"
                    and collection_asset.owner_id == hike.location_id
                )
                if not matches:
                    raise MediaError(
                        "Selected collection does not belong to this hike or its trail"
                    )
            else:
                try:
                    validate_selection(db, hike.id, hike.location_id, collection_id)
                except ValueError as error:
                    raise MediaError(str(error)) from error
            action = (
                "skip"
                if hike.track_collection_id == collection_id
                else "add"
                if hike.track_collection_id is None
                else "replace"
            )
        elif asset.kind in {"collection", "gpx"}:
            from knut_vandrar_backend.tracks.transfer import plan

            action = plan(db, asset, media_root)
            if asset.kind == "gpx":
                collection_id = asset.track_data["collection_id"]
                incoming = index.execute(
                    "SELECT data FROM assets WHERE kind='collection' AND target=?", (collection_id,)
                ).fetchone()
                if (
                    incoming is None
                    or Asset.model_validate_json(incoming[0]).owner_id != asset.owner_id
                    or Asset.model_validate_json(incoming[0]).track_owner != asset.track_owner
                ):
                    raise MediaError("GPX archive requires its collection with the same owner")
        elif asset.kind == "photo":
            for text in asset.translations:
                if text.locale_code not in locales:
                    raise MediaError(f"Unsupported destination locale: {text.locale_code}")
            photo = db.scalar(select(Photo).where(Photo.id == asset.id).with_for_update())
            incoming_digest = asset.files["original"].sha256
            _safe_directory(media_root, asset.id, incoming_digest)
            incoming_version = media_root / "photos" / str(asset.id) / "versions" / incoming_digest
            if any((incoming_version / variant).is_symlink() for variant in asset.files):
                raise MediaError(f"Unsafe destination photo generation: {asset.id}")
            if incoming_version.exists() and any(
                (incoming_version / variant).exists()
                and file_info(incoming_version / variant) != expected
                for variant, expected in asset.files.items()
            ):
                raise MediaError(f"Conflicting staged image generation: {asset.id}")
            if photo is not None and photo.hike_id != asset.owner_id:
                raise MediaError(f"Photo ID belongs to a different destination hike: {asset.id}")
            if photo is not None:
                same = _photo_matches(db, photo, asset)
                same_digest = photo.digest == asset.files["original"].sha256
                directory = _safe_directory(media_root, photo.id, photo.digest)
                missing = False
                for variant, expected in asset.files.items():
                    path = directory / variant
                    if path.is_symlink():
                        raise MediaError(f"Unsafe destination photo file: {photo.id}/{variant}")
                    if not path.exists():
                        missing = True
                    elif same_digest and file_info(path) != expected:
                        raise MediaError(
                            f"Photo {photo.id} has different bytes under the same immutable URL; "
                            "import it with a new photo ID instead"
                        )
                action = "repair" if same and missing else "skip" if same else "replace"
        else:
            image = _database_image(db, asset.kind, asset.owner_id)
            if image is not None:
                same = (
                    image.sha256 == asset.files["image"].sha256
                    and image.content_type == asset.content_type
                    and hashlib.sha256(image.content).hexdigest() == asset.files["image"].sha256
                )
                missing = False
                if same and isinstance(image, HikeCoverImage):
                    for kind in asset.files.keys() - {"image"}:
                        existing_asset = image.assets.get(kind)
                        if existing_asset is None:
                            missing = True
                        elif (
                            existing_asset.sha256 != asset.files[kind].sha256
                            or hashlib.sha256(existing_asset.content).hexdigest()
                            != existing_asset.sha256
                        ):
                            same = False
                            break
                action = ("repair" if missing else "skip") if same else "replace"
        if action == "replace" and not replace:
            report.conflict(f"{asset.kind}/{asset.id}: existing image or metadata differs")
            action = "conflict"
        else:
            report.counts[action] += 1
        index.execute("UPDATE assets SET action=? WHERE rowid=?", (action, row_id))
        progress.report(f"Checked {sum(report.counts.values())} destination images...", force=False)
    index.commit()
    return report


def _apply_photo(
    db: Session, asset: Asset, work: Path, media_root: Path, source_id: str, *, repair: bool
) -> None:
    photo = db.get(Photo, asset.id)
    old_digest = photo.digest if photo else None
    digest = asset.files["original"].sha256
    version = media_root / "photos" / str(asset.id) / "versions" / digest
    _safe_directory(media_root, asset.id, digest)
    if version.exists() and any(
        (version / variant).exists() and file_info(version / variant) != expected
        for variant, expected in asset.files.items()
    ):
        raise MediaError(f"Conflicting staged image generation: {asset.id}")
    if not version.exists() or any(not (version / variant).exists() for variant in asset.files):
        source = work / "staging" / "photo" / source_id
        for variant in asset.files:
            with (source / variant).open("rb") as handle:
                os.fsync(handle.fileno())
        sync_directory(source)
        publish_photo(work, media_root, asset.id, asset.owner_id, digest, old_digest)
    if repair:
        return
    if photo is None:
        order = db.scalar(select(func.max(Photo.sort_order)).where(Photo.hike_id == asset.owner_id))
        photo = Photo(
            id=asset.id, hike_id=asset.owner_id, sort_order=0 if order is None else order + 1
        )
        revision = asset.source_revision
        db.add(photo)
    else:
        revision = max(photo.source_revision, asset.source_revision) + 1
        # Workers must observe a new revision, even if they started before the import.
        for job in db.scalars(
            select(TranslationJob).where(
                TranslationJob.entity_type == "photo",
                TranslationJob.entity_id == photo.id,
                TranslationJob.status.in_(("queued", "running")),
            )
        ):
            job.status = "superseded"
    photo.digest, photo.original_type = digest, asset.content_type
    photo.width, photo.height = asset.width, asset.height
    photo.source_revision = revision
    db.flush()
    for text in asset.translations:
        target = db.get(PhotoTranslation, (photo.id, text.locale_code))
        if target is None:
            target = PhotoTranslation(photo_id=photo.id, locale_code=text.locale_code)
            db.add(target)
        for key, value in text.model_dump().items():
            setattr(target, key, value)
        target.source_revision = revision + text.source_revision - asset.source_revision
    db.flush()


def import_archive(
    factory: sessionmaker[Session],
    media_root: Path,
    source: BinaryIO,
    *,
    dry_run: bool = False,
    replace: bool = False,
    max_bytes: int = DEFAULT_MAX_BYTES,
    hike_map: dict[UUID, UUID] | None = None,
    location_map: dict[UUID, UUID] | None = None,
    progress: Progress | None = None,
) -> ImportReport:
    progress = progress or Progress()
    progress.report("Preparing media import...")
    with transfer_lock(media_root) as transfers:
        if dry_run and any(path.name != "lock" for path in transfers.iterdir()):
            raise MediaError(
                "An interrupted import needs recovery; run media-import.sh ENV --recover"
            )
        if not dry_run:
            recover_transfers(factory, media_root, transfers)
        transfer_id = uuid4()
        work = transfers / str(transfer_id)
        work.mkdir(mode=0o700)
        sync_directory(transfers)
        staging = work / "staging"
        staging.mkdir(mode=0o700)
        try:
            progress.report("Receiving and extracting archive...")
            manifest = unpack_archive(source, staging, max_bytes, progress)
            with closing(sqlite3.connect(work / "index.sqlite")) as index:
                progress.report("Verifying archive checksums and metadata...")
                index_archive(staging, index, progress)
                total = index.execute("SELECT COUNT(*) FROM assets").fetchone()[0]
                progress.report(f"Validating {total} images...")
                for count, asset in enumerate(read_assets(index), start=1):
                    _validate_images(asset, staging)
                    progress.report(f"Validated {count}/{total} images...", force=False)
                _remap(index, hike_map or {}, location_map or {})
                with factory.begin() as db:
                    if manifest.schema_revision != schema_revision(db):
                        raise MediaError("Source and destination Alembic revisions must match")
                    progress.report(
                        "Checking destination records (waiting for database locks if needed)..."
                    )
                    _lock_owners(db, index)
                    report = _plan(db, index, media_root, replace, progress)
                    progress.report(f"Destination check complete: {total} images.")
                    if (
                        report.counts["conflict"]
                        or dry_run
                        or not any(report.counts[key] for key in ("add", "replace", "repair"))
                    ):
                        # Planning never changes SQL records or published image files.
                        return report
                    progress.report("Applying image changes...")
                    for applied, (source_id, value, action) in enumerate(
                        index.execute(
                            "SELECT id, data, action FROM assets WHERE action != 'skip' "
                            "ORDER BY CASE WHEN kind='collection' THEN 0 WHEN kind='track_selection' THEN 2 ELSE 1 END, owner, sort_order, id"
                        ),
                        start=1,
                    ):
                        asset = Asset.model_validate_json(value)
                        if asset.kind == "track_selection":
                            from knut_vandrar_backend.tracks.selection import validate_selection

                            hike = db.get(Hike, asset.owner_id)
                            if hike is None:
                                raise MediaError("Missing destination hike")
                            collection_id = UUID(asset.track_data["collection_id"])
                            validate_selection(db, hike.id, hike.location_id, collection_id)
                            hike.track_collection_id = collection_id
                            db.flush()
                        elif asset.kind in {"collection", "gpx"}:
                            from knut_vandrar_backend.tracks.transfer import apply

                            apply(db, asset, staging, media_root, source_id)
                        elif asset.kind == "photo":
                            _apply_photo(
                                db, asset, work, media_root, source_id, repair=action == "repair"
                            )
                        else:
                            image = _database_image(db, asset.kind, asset.owner_id)
                            if image is None:
                                image = (
                                    LocationLogo(location_id=asset.owner_id)
                                    if asset.kind == "logo"
                                    else HikeCoverImage(hike_id=asset.owner_id)
                                )
                                db.add(image)
                            path = staging / asset.kind / source_id / "image"
                            if isinstance(image, HikeCoverImage):
                                if (
                                    action == "replace"
                                    and image.sha256 != asset.files["image"].sha256
                                ):
                                    for kind in image.assets.keys() - asset.files.keys():
                                        del image.assets[kind]
                                for kind in asset.files.keys() - {"image"}:
                                    content = (path.parent / kind).read_bytes()
                                    image.set_asset(kind, content, asset.files[kind].sha256)
                            image.content = path.read_bytes()
                            image.content_type = asset.content_type
                            image.sha256 = asset.files["image"].sha256
                            db.flush()
                        progress.report(f"Applied {applied} image changes...", force=False)
                    progress.report("Committing database changes...")
                    db.add(MediaImportReceipt(id=transfer_id))
            progress.report("Cleaning up committed import...")
            recover_transfers(factory, media_root, transfers)
            return report
        except BaseException:
            # A failed commit can be ambiguous; recovery consults a fresh SQL connection.
            if not dry_run:
                recover_transfers(factory, media_root, transfers)
            raise
        finally:
            # No published file operations have happened for dry runs/conflict-only plans.
            if work.exists() and not (work / "operations.jsonl").exists():
                shutil.rmtree(work)
