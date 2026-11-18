"""Portable media round trips, validation, conflict policy, and crash recovery."""

import hashlib
import json
import shutil
import sqlite3
import tarfile
from collections.abc import Iterator
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from PIL import Image
from sqlalchemy import create_engine, delete, event, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.database.base import Base
from knut_vandrar_backend.media import transfer
from knut_vandrar_backend.media.archive import MediaError, export_archive
from knut_vandrar_backend.media.recovery import publish_photo, recover_transfers, transfer_lock
from knut_vandrar_backend.media.storage import photo_files_directory
from knut_vandrar_backend.models.enums import TranslationReviewStatus
from knut_vandrar_backend.models.hike import Hike, HikeCoverImage
from knut_vandrar_backend.models.location import HikingLocation, LocationLogo
from knut_vandrar_backend.models.media import MediaImportReceipt
from knut_vandrar_backend.models.photo import Photo, PhotoTranslation
from knut_vandrar_backend.models.reference import Language
from knut_vandrar_backend.models.translation import TranslationJob

HIKE = UUID(int=2)
LOCATION = UUID(int=1)
PHOTO = UUID(int=11)
SECOND_PHOTO = UUID(int=12)


@dataclass
class Environment:
    engine: Engine
    factory: sessionmaker[Session]
    media: Path


def _image(color: str = "green", format: str = "PNG") -> bytes:
    output = BytesIO()
    Image.new("RGB", (20, 10), color).save(output, format=format)
    return output.getvalue()


def _photo(environment: Environment, identifier: UUID, order: int, color: str = "green") -> None:
    original = _image(color)
    directory = environment.media / "photos" / str(identifier)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "original").write_bytes(original)
    for variant in ("thumbnail", "fullscreen"):
        (directory / variant).write_bytes(_image(color, "WEBP"))
    with environment.factory.begin() as db:
        photo = db.get(Photo, identifier)
        if photo is None:
            photo = Photo(id=identifier, hike_id=HIKE, sort_order=order)
            db.add(photo)
        photo.original_type = "image/png"
        photo.digest = hashlib.sha256(original).hexdigest()
        photo.width, photo.height, photo.source_revision = 20, 10, 4
        db.flush()
        for locale, revision, status in (
            ("en", 4, TranslationReviewStatus.SOURCE),
            ("sv", 3, TranslationReviewStatus.MANUAL),
        ):
            if db.get(PhotoTranslation, (identifier, locale)) is None:
                db.add(
                    PhotoTranslation(
                        photo_id=identifier,
                        locale_code=locale,
                        source_revision=revision,
                        review_status=status,
                        alt=f"{locale} description",
                        caption=f"{locale} caption",
                        profile_fingerprint="a" * 64 if locale != "en" else None,
                    )
                )


@pytest.fixture()
def environments(tmp_path: Path) -> Iterator[tuple[Environment, Environment]]:
    environments = []
    for name in ("source", "destination"):
        root = tmp_path / name
        root.mkdir()
        engine = create_engine(f"sqlite:///{root / 'database.sqlite'}")

        @event.listens_for(engine, "connect")
        def foreign_keys(connection: sqlite3.Connection, _: object) -> None:
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE alembic_version (version_num TEXT)"))
            connection.execute(text("INSERT INTO alembic_version VALUES ('009_media_imports')"))
        environment = Environment(
            engine, sessionmaker(bind=engine, autoflush=False), root / "media"
        )
        with environment.factory.begin() as db:
            db.add_all(
                [
                    Language(code=locale, name=locale, enabled=True, is_source=locale == "en")
                    for locale in ("en", "sv", "cs")
                ]
            )
            db.add(HikingLocation(id=LOCATION))
            db.flush()
            db.add(Hike(id=HIKE, location_id=LOCATION))
        environments.append(environment)
    source, destination = environments
    _photo(source, PHOTO, 5)
    _photo(source, SECOND_PHOTO, 1, "red")
    with source.factory.begin() as db:
        cover = _image("blue")
        logo = b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>'
        db.add(
            HikeCoverImage(
                hike_id=HIKE,
                content=cover,
                content_type="image/png",
                sha256=hashlib.sha256(cover).hexdigest(),
            )
        )
        db.add(
            LocationLogo(
                location_id=LOCATION,
                content=logo,
                content_type="image/svg+xml",
                sha256=hashlib.sha256(logo).hexdigest(),
            )
        )
    yield source, destination
    for environment in environments:
        environment.engine.dispose()


def _export(environment: Environment, **filters: tuple[UUID, ...]) -> bytes:
    output = BytesIO()
    with environment.factory.begin() as db:
        assert (
            export_archive(
                db,
                environment.media,
                output,
                hikes=filters.get("hikes", ()),
                locations=filters.get("locations", ()),
            )
            >= 0
        )
    return output.getvalue()


def _import(
    environment: Environment, archive: bytes, *, dry_run: bool = False, replace: bool = False
) -> transfer.ImportReport:
    return transfer.import_archive(
        environment.factory,
        environment.media,
        BytesIO(archive),
        dry_run=dry_run,
        replace=replace,
    )


def test_round_trip_dry_run_ordering_and_idempotence(
    environments: tuple[Environment, Environment],
) -> None:
    source, destination = environments
    _photo(destination, UUID(int=99), 10)
    archive = _export(source)
    assert _import(destination, archive, dry_run=True).counts == {"add": 4}
    with destination.factory() as db:
        assert db.scalar(select(func.count()).select_from(Photo)) == 1
        assert db.get(HikeCoverImage, HIKE) is None
    assert _import(destination, archive).counts == {"add": 4}
    with destination.factory() as db:
        photos = list(db.scalars(select(Photo).order_by(Photo.sort_order)))
        assert [photo.id for photo in photos] == [UUID(int=99), SECOND_PHOTO, PHOTO]
        imported = db.get(Photo, PHOTO)
        assert imported is not None
        directory = photo_files_directory(destination.media, PHOTO, imported.digest)
        for variant in ("original", "thumbnail", "fullscreen"):
            assert (directory / variant).read_bytes() == (
                source.media / "photos" / str(PHOTO) / variant
            ).read_bytes()
        swedish = db.get(PhotoTranslation, (PHOTO, "sv"))
        assert swedish is not None
        assert swedish.caption == "sv caption"
        assert swedish.review_status == TranslationReviewStatus.MANUAL
        assert swedish.source_revision == imported.source_revision - 1
        assert db.scalar(select(func.count()).select_from(TranslationJob)) == 0
        assert db.scalar(select(func.count()).select_from(MediaImportReceipt)) == 0
    assert _import(destination, archive).counts == {"skip": 4}
    assert [path.name for path in (destination.media / ".transfers").iterdir()] == ["lock"]


def test_conflicts_are_all_or_nothing_and_replace_preserves_other_locales(
    environments: tuple[Environment, Environment],
) -> None:
    source, destination = environments
    archive = _export(source)
    _import(destination, archive)
    with destination.factory.begin() as db:
        english = db.get(PhotoTranslation, (PHOTO, "en"))
        assert english is not None
        english.alt = "Destination edit"
        db.add(
            PhotoTranslation(
                photo_id=PHOTO,
                locale_code="cs",
                alt="Keep this",
                caption=None,
                source_revision=4,
                review_status=TranslationReviewStatus.MANUAL,
            )
        )
        cover = db.get(HikeCoverImage, HIKE)
        assert cover is not None
        cover.content = _image("yellow")
        cover.sha256 = hashlib.sha256(cover.content).hexdigest()
        db.add(
            TranslationJob(
                entity_type="photo",
                entity_id=PHOTO,
                target_locale="sv",
                source_revision=4,
                profile_fingerprint="b" * 64,
                reason="manual_request",
                status="running",
            )
        )
    report = _import(destination, archive)
    assert report.counts == {"skip": 2, "conflict": 2}
    with destination.factory() as db:
        english = db.get(PhotoTranslation, (PHOTO, "en"))
        assert english is not None and english.alt == "Destination edit"
    assert _import(destination, archive, replace=True).counts == {"skip": 2, "replace": 2}
    with destination.factory() as db:
        photo = db.get(Photo, PHOTO)
        assert photo is not None and photo.source_revision == 5
        czech = db.get(PhotoTranslation, (PHOTO, "cs"))
        assert czech is not None and czech.alt == "Keep this"
        assert db.scalar(select(TranslationJob.status)) == "superseded"
    assert _import(destination, archive).counts == {"skip": 4}


def test_missing_files_can_be_repaired_without_reoptimizing(
    environments: tuple[Environment, Environment],
) -> None:
    source, destination = environments
    archive = _export(source)
    _import(destination, archive)
    with destination.factory() as db:
        photo = db.get(Photo, PHOTO)
        assert photo is not None
        directory = photo_files_directory(destination.media, PHOTO, photo.digest)
    # Simulate missing legacy media: recovery builds a complete generation.
    legacy = directory.parent.parent
    for variant in ("original", "thumbnail", "fullscreen"):
        (legacy / variant).write_bytes((directory / variant).read_bytes())
    shutil.rmtree(directory)
    (legacy / "thumbnail").unlink()
    assert _import(destination, archive).counts == {"skip": 3, "repair": 1}
    assert _import(destination, archive).counts == {"skip": 4}
    (directory / "thumbnail").unlink()
    assert _import(destination, archive).counts == {"skip": 3, "repair": 1}
    assert _import(destination, archive).counts == {"skip": 4}
    with destination.factory() as db:
        photo = db.get(Photo, PHOTO)
        assert photo is not None and photo.source_revision == 4


def test_filtering_and_explicit_owner_mapping(
    environments: tuple[Environment, Environment],
) -> None:
    source, destination = environments
    target_hike, target_location = UUID(int=20), UUID(int=21)
    with destination.factory.begin() as db:
        db.add(HikingLocation(id=target_location))
        db.flush()
        db.add(Hike(id=target_hike, location_id=target_location))
        db.execute(delete(Photo))
        db.execute(delete(Hike).where(Hike.id == HIKE))
        db.execute(delete(HikingLocation).where(HikingLocation.id == LOCATION))
    archive = _export(source, hikes=(HIKE,))
    with pytest.raises(MediaError, match="Missing destination"):
        _import(destination, archive)
    report = transfer.import_archive(
        destination.factory,
        destination.media,
        BytesIO(archive),
        hike_map={HIKE: target_hike},
        location_map={LOCATION: target_location},
    )
    assert report.counts == {"add": 4}
    with destination.factory() as db:
        photo = db.get(Photo, PHOTO)
        assert photo is not None and photo.hike_id == target_hike
        assert db.get(HikeCoverImage, target_hike) is not None
        assert db.get(LocationLogo, target_location) is not None
    assert _export(source, locations=(LOCATION,)) == archive
    with pytest.raises(MediaError, match="Unknown"):
        _export(source, hikes=(UUID(int=999),))


def test_replacement_serves_previous_generation_until_commit(
    environments: tuple[Environment, Environment],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from dataclasses import replace

    from knut_vandrar_backend.api import photos
    from knut_vandrar_backend.settings import settings

    source, destination = environments
    _import(destination, _export(source))
    monkeypatch.setattr(photos, "settings", replace(settings, media_root=destination.media))
    with destination.factory() as db:
        existing = db.get(Photo, PHOTO)
        assert existing is not None
        previous_digest = existing.digest
        previous_path = photo_files_directory(destination.media, PHOTO, previous_digest)
        previous_image = (previous_path / "fullscreen").read_bytes()
    _photo(source, PHOTO, 5, "purple")
    inspected = False

    def before_commit(db: Session) -> None:
        nonlocal inspected
        if not any(isinstance(row, MediaImportReceipt) for row in db.new):
            return
        with destination.factory() as reader:
            response = photos.get_image(PHOTO, "fullscreen", previous_digest, reader)
            assert Path(response.path).read_bytes() == previous_image
            assert Path(photos.get_original(PHOTO, reader).path).is_file()
        inspected = True

    event.listen(destination.factory, "before_commit", before_commit)
    assert _import(destination, _export(source), replace=True).counts == {"replace": 1, "skip": 3}
    event.remove(destination.factory, "before_commit", before_commit)
    assert inspected
    with destination.factory() as db:
        photo = db.get(Photo, PHOTO)
        assert photo is not None and photo.digest != previous_digest
        response = photos.get_image(PHOTO, "fullscreen", photo.digest, db)
        assert Path(response.path).read_bytes() != previous_image
        assert Path(photos.get_original(PHOTO, db).path).read_bytes() == _image("purple")
    assert not previous_path.exists()
    assert _import(destination, _export(source)).counts == {"skip": 4}


def test_same_digest_never_overwrites_immutable_derivatives(
    environments: tuple[Environment, Environment],
) -> None:
    source, destination = environments
    archive = _export(source)
    _import(destination, archive)
    # Simulate a different encoder producing new derivatives from the same original.
    (source.media / "photos" / str(PHOTO) / "thumbnail").write_bytes(_image("pink", "WEBP"))
    with pytest.raises(MediaError, match="Conflicting staged image generation"):
        _import(destination, _export(source), replace=True)


def _rewrite(
    archive: bytes,
    *,
    path: str | None = None,
    kind: bytes = tarfile.REGTYPE,
    damage: bool = False,
    revision: bool = False,
) -> bytes:
    output = BytesIO()
    with (
        tarfile.open(fileobj=BytesIO(archive)) as source,
        tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as target,
    ):
        for member in source:
            content = source.extractfile(member)
            assert content is not None
            value = content.read()
            if damage and member.name.endswith("/original"):
                value = bytes(len(value))
            if revision and member.name == "manifest.json":
                metadata = json.loads(value)
                metadata["schema_revision"] = "incompatible"
                value = json.dumps(metadata).encode()
            member.size = len(value)
            target.addfile(member, BytesIO(value))
        if path:
            extra = tarfile.TarInfo(path)
            extra.type, extra.size, extra.linkname = kind, 1, "/etc/passwd"
            target.addfile(extra, BytesIO(b"x"))
    return output.getvalue()


@pytest.mark.parametrize(
    "case",
    [
        "traversal",
        "symlink",
        "extended",
        "duplicate",
        "orphan",
        "damage",
        "revision",
        "limit",
        "truncated",
    ],
)
def test_invalid_archives_never_publish_images(
    environments: tuple[Environment, Environment],
    case: str,
) -> None:
    source, destination = environments
    archive = _export(source)
    if case == "traversal":
        archive = _rewrite(archive, path="../escaped")
    elif case == "symlink":
        archive = _rewrite(archive, path=f"photo/{PHOTO}/original", kind=tarfile.SYMTYPE)
    elif case == "extended":
        archive = _rewrite(archive, path="extended", kind=tarfile.XHDTYPE)
    elif case == "duplicate":
        archive = _rewrite(archive, path="manifest.json")
    elif case == "orphan":
        archive = _rewrite(archive, path=f"photo/{uuid4()}/original")
    elif case == "damage":
        archive = _rewrite(archive, damage=True)
    elif case == "revision":
        archive = _rewrite(archive, revision=True)
    elif case == "truncated":
        archive = archive[:1024]
    with pytest.raises(MediaError):
        transfer.import_archive(
            destination.factory,
            destination.media,
            BytesIO(archive),
            max_bytes=100 if case == "limit" else 1024 * 1024,
        )
    with destination.factory() as db:
        assert db.scalar(select(func.count()).select_from(Photo)) == 0
        assert db.get(HikeCoverImage, HIKE) is None
    assert not list((destination.media / "photos").glob("*/versions/*"))


@pytest.mark.parametrize("repair", [False, True])
def test_failed_apply_rolls_back_files_and_database(
    environments: tuple[Environment, Environment],
    monkeypatch: pytest.MonkeyPatch,
    repair: bool,
) -> None:
    source, destination = environments
    if repair:
        _import(destination, _export(source))
        with destination.factory() as db:
            photo = db.get(Photo, PHOTO)
            assert photo is not None
            directory = photo_files_directory(destination.media, PHOTO, photo.digest)
        (directory / "thumbnail").unlink()
    original_files = {
        path.relative_to(destination.media): path.read_bytes()
        for path in (destination.media / "photos").rglob("*")
        if path.is_file()
    }

    def fail_after_publish(
        work: Path,
        media_root: Path,
        photo_id: UUID,
        hike_id: UUID,
        digest: str,
        old_digest: str | None,
    ) -> None:
        publish_photo(work, media_root, photo_id, hike_id, digest, old_digest)
        raise OSError("Simulated failure after publishing files")

    monkeypatch.setattr(transfer, "publish_photo", fail_after_publish)
    with pytest.raises(OSError, match="Simulated"):
        _import(destination, _export(source))
    with destination.factory() as db:
        assert db.scalar(select(func.count()).select_from(Photo)) == (2 if repair else 0)
        assert (db.get(HikeCoverImage, HIKE) is not None) == repair
    assert {
        path.relative_to(destination.media): path.read_bytes()
        for path in (destination.media / "photos").rglob("*")
        if path.is_file()
    } == original_files


@pytest.mark.parametrize("committed", [False, True])
def test_crash_journal_uses_database_commit_receipt(
    environments: tuple[Environment, Environment],
    monkeypatch: pytest.MonkeyPatch,
    committed: bool,
) -> None:
    source, destination = environments
    calls = 0

    def simulated_crash(factory: sessionmaker[Session], media_root: Path, transfers: Path) -> int:
        nonlocal calls
        calls += 1
        if calls > 1:
            raise OSError("Simulated crash before journal cleanup")
        return recover_transfers(factory, media_root, transfers)

    monkeypatch.setattr(transfer, "recover_transfers", simulated_crash)
    if not committed:

        def fail_flush(db: Session, _: object, __: object) -> None:
            if any(isinstance(row, Photo) for row in db.new):
                raise OSError("Simulated crash before database commit")

        event.listen(destination.factory, "before_flush", fail_flush)
    with pytest.raises(OSError):
        _import(destination, _export(source))
    assert list((destination.media / "photos").glob("*/versions/*"))
    with pytest.raises(MediaError, match="needs recovery"):
        _import(destination, _export(source), dry_run=True)
    with transfer_lock(destination.media) as transfers:
        assert recover_transfers(destination.factory, destination.media, transfers) == 1
    with destination.factory() as db:
        assert db.scalar(select(func.count()).select_from(Photo)) == (2 if committed else 0)
        assert db.scalar(select(func.count()).select_from(MediaImportReceipt)) == 0
    assert bool(list((destination.media / "photos").glob("*/versions/*"))) == committed


def test_progress_reports_export_and_dry_run_stages(
    environments: tuple[Environment, Environment],
) -> None:
    from knut_vandrar_backend.media.progress import Progress

    source, destination = environments
    messages: list[str] = []
    archive = BytesIO()
    with source.factory.begin() as db:
        export_archive(db, source.media, archive, progress=Progress(messages.append))
    assert messages[0] == "Exporting images and metadata..."
    assert messages[-1] == "Archive complete: 4 images."
    messages.clear()
    archive.seek(0)
    report = transfer.import_archive(
        destination.factory,
        destination.media,
        archive,
        dry_run=True,
        progress=Progress(messages.append),
    )
    assert report.counts == {"add": 4}
    assert messages[0] == "Preparing media import..."
    assert any(message.startswith("Archive received:") for message in messages)
    assert "Verifying archive checksums and metadata..." in messages
    assert "Validating 4 images..." in messages
    assert messages[-1] == "Destination check complete: 4 images."
    assert "Applying image changes..." not in messages
