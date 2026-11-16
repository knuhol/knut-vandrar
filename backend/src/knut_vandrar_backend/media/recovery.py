"""Durable undo journal bridging a SQL transaction and private image files."""

import fcntl
import json
import os
import shutil
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.media.archive import MediaError
from knut_vandrar_backend.media.storage import PHOTO_FILES
from knut_vandrar_backend.models.hike import Hike
from knut_vandrar_backend.models.media import MediaImportReceipt


def sync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


@contextmanager
def transfer_lock(media_root: Path) -> Iterator[Path]:
    media_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    transfers = media_root / ".transfers"
    photos = media_root / "photos"
    for directory in (transfers, photos):
        if directory.is_symlink():
            raise MediaError("Media directories must not be symbolic links")
        directory.mkdir(exist_ok=True, mode=0o700)
    lock = transfers / "lock"
    if lock.is_symlink():
        raise MediaError("Transfer lock must not be a symbolic link")
    with lock.open("a+b") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise MediaError("Another media transfer is running in this environment") from error
        try:
            yield transfers
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def publish_photo(
    work: Path,
    media_root: Path,
    photo_id: UUID,
    hike_id: UUID,
    digest: str,
    old_digest: str | None,
) -> None:
    base = media_root / "photos" / str(photo_id)
    versions = base / "versions"
    destination = versions / digest
    for path in (base, versions, destination):
        if path.is_symlink() or (path.exists() and not path.is_dir()):
            raise MediaError(f"Unsafe destination photo directory: {photo_id}")
    new_generation = not destination.exists()
    missing = [variant for variant in PHOTO_FILES if not (destination / variant).exists()]
    if not new_generation and not missing:
        return
    operation = dict(
        photo_id=str(photo_id),
        hike_id=str(hike_id),
        digest=digest,
        old_digest=old_digest,
        new_generation=new_generation,
        created_variants=missing,
    )
    with (work / "operations.jsonl").open("ab") as journal:
        journal.write(json.dumps(operation).encode() + b"\n")
        journal.flush()
        os.fsync(journal.fileno())
    sync_directory(work)
    versions.mkdir(parents=True, exist_ok=True, mode=0o700)
    sync_directory(base.parent)
    sync_directory(base)
    staged = work / "staging" / "photo" / str(photo_id)
    if new_generation:
        staged.rename(destination)
    else:
        for variant in missing:
            os.link(staged / variant, destination / variant)
        sync_directory(destination)
    sync_directory(destination.parent)


def recover_transfers(factory: sessionmaker[Session], media_root: Path, transfers: Path) -> int:
    """Caller holds the transfer lock; receipts distinguish commit from rollback."""
    recovered = 0
    for work in sorted(transfers.iterdir()):
        if work.name == "lock":
            continue
        if work.is_symlink() or not work.is_dir():
            raise MediaError("Unexpected file in the transfer journal directory")
        transfer_id = UUID(work.name)
        with factory.begin() as db:
            committed = db.get(MediaImportReceipt, transfer_id)
            operations = work / "operations.jsonl"
            if operations.exists():
                with operations.open("r") as journal:
                    for line in journal:
                        # A torn final append precedes any filesystem mutation for that entry.
                        if not line.endswith("\n"):
                            break
                        operation = json.loads(line)
                        photo_id = UUID(operation["photo_id"])
                        hike_id = UUID(operation["hike_id"])
                        db.execute(select(Hike.id).where(Hike.id == hike_id).with_for_update())
                        base = media_root / "photos" / str(photo_id)
                        digest = operation["digest"]
                        if (
                            not isinstance(digest, str)
                            or len(digest) != 64
                            or any(char not in "0123456789abcdef" for char in digest)
                        ):
                            raise MediaError("Invalid image digest in recovery journal")
                        destination = base / "versions" / digest
                        if base.is_symlink() or destination.parent.is_symlink():
                            raise MediaError("Unsafe path encountered during media recovery")
                        if committed is None:
                            if destination.is_symlink():
                                raise MediaError("Unsafe image generation in recovery journal")
                            if operation["new_generation"] and destination.is_dir():
                                shutil.rmtree(destination)
                            elif not operation["new_generation"]:
                                for variant in operation["created_variants"]:
                                    if variant not in PHOTO_FILES:
                                        raise MediaError(
                                            "Invalid repair variant in recovery journal"
                                        )
                                    (destination / variant).unlink(missing_ok=True)
                        else:
                            old_digest = operation["old_digest"]
                            if old_digest is not None and (
                                not isinstance(old_digest, str)
                                or len(old_digest) != 64
                                or any(char not in "0123456789abcdef" for char in old_digest)
                            ):
                                raise MediaError("Invalid old image digest in recovery journal")
                            if old_digest is not None and old_digest != digest:
                                old = base / "versions" / old_digest
                                if old.is_symlink():
                                    raise MediaError("Unsafe old image generation")
                                if old.exists():
                                    shutil.rmtree(old)
                            for variant in PHOTO_FILES:
                                (base / variant).unlink(missing_ok=True)
                            if base.exists():
                                sync_directory(base)
                        if destination.parent.exists():
                            sync_directory(destination.parent)
            # Remove the journal before its receipt: a crash can only leave a harmless receipt.
            shutil.rmtree(work)
            sync_directory(transfers)
            if committed is not None:
                db.delete(committed)
        recovered += 1
    # A crash between journal removal and receipt cleanup can leave orphan receipts.
    # The exclusive transfer lock and empty journal directory make all remaining ones obsolete.
    with factory.begin() as db:
        db.execute(delete(MediaImportReceipt))
    return recovered
