"""Shared resolution of legacy uploads and transactionally published image generations."""

from pathlib import Path
from uuid import UUID

PHOTO_FILES = ("original", "thumbnail", "fullscreen")


def photo_files_directory(media_root: Path, photo_id: UUID, digest: str) -> Path:
    base = media_root / "photos" / str(photo_id)
    generation = base / "versions" / digest
    return generation if generation.is_dir() else base
