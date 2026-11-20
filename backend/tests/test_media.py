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
from typing import Any
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


def test_tracks_share_media_archive_and_preserve_destination_content(
    environments: tuple[Environment, Environment],
) -> None:
    from knut_vandrar_backend.models.track import TrackCollection, TrackDraft, TrackRoute
    from knut_vandrar_backend.tracks.gpx import normalize, store, track_path

    source, destination = environments
    raw = b'<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="2" lon="3"/></trkseg></trk></gpx>'
    content, _ = normalize(raw, "Trail 7A")
    digest = store(source.media, content)
    collection_id, route_id = uuid4(), uuid4()
    with source.factory.begin() as db:
        db.add(
            TrackCollection(
                id=collection_id,
                location_id=LOCATION,
                source_id="20512",
                name="Trail",
                direction="backward",
                details={},
            )
        )
        db.flush()
        db.add(
            TrackRoute(
                id=route_id,
                collection_id=collection_id,
                source_id="123",
                details={"stage": "7A"},
                overrides={"start": "Manual"},
                digest=digest,
            )
        )
        db.add(TrackDraft(location_id=LOCATION, source_id="999", data={"private": True}))
    archive = _export(source)
    dry = transfer.import_archive(
        destination.factory, destination.media, BytesIO(archive), dry_run=True
    )
    assert dry.counts["add"] >= 2
    with destination.factory() as db:
        assert db.get(TrackCollection, collection_id) is None
    assert not track_path(destination.media, digest).exists()
    result = transfer.import_archive(destination.factory, destination.media, BytesIO(archive))
    assert result.counts["add"] >= 2
    with destination.factory() as db:
        imported_route = db.get(TrackRoute, route_id)
        assert imported_route is not None
        assert imported_route.overrides == {"start": "Manual"}
        assert db.scalar(select(func.count()).select_from(TrackDraft)) == 0
    assert track_path(destination.media, digest).read_bytes() == content
    again = transfer.import_archive(destination.factory, destination.media, BytesIO(archive))
    assert not again.counts["add"] and not again.counts["replace"]
    track_path(destination.media, digest).unlink()
    repair = transfer.import_archive(destination.factory, destination.media, BytesIO(archive))
    assert repair.counts["repair"] == 1


def test_draft_survives_sessions_and_publishes_only_when_reviewed(
    environments: tuple[Environment, Environment],
) -> None:
    from knut_vandrar_backend.models.track import TrackCollection, TrackDraft, TrackRoute
    from knut_vandrar_backend.tracks.gpx import store
    from knut_vandrar_backend.tracks.service import publish, save_draft

    source, _ = environments
    staging = source.media / ".track-drafts" / "test"
    raw = b'<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="2" lon="3"/></trkseg></trk></gpx>'
    digest = store(staging, raw)
    data: dict[str, Any] = {
        "name": "Trail",
        "direction": "backward",
        "discovered": True,
        "errors": {},
        "seen": ["123"],
        "routes": {
            "123": {
                "details": {"name": "Trail 7A", "stage": "7A"},
                "overrides": {},
                "digest": digest,
                "reviewed": False,
            }
        },
    }
    with source.factory.begin() as db:
        draft = TrackDraft(location_id=LOCATION, source_id="20512", data=data)
        db.add(draft)
        db.flush()
        draft_id = draft.id
    data["routes"]["123"]["overrides"]["start"] = "Manual"
    save_draft(source.factory, draft_id, data)
    with source.factory.begin() as db:
        restored = db.get(TrackDraft, draft_id)
        assert restored is not None
        assert restored.data["routes"]["123"]["overrides"]["start"] == "Manual"
        with pytest.raises(ValueError, match="review"):
            publish(db, restored, staging, source.media)
        assert db.scalar(select(func.count()).select_from(TrackCollection)) == 0
    data["routes"]["123"]["reviewed"] = True
    save_draft(source.factory, draft_id, data)
    with source.factory.begin() as db:
        restored = db.get(TrackDraft, draft_id)
        assert restored is not None
        publish(db, restored, staging, source.media)
    with source.factory() as db:
        assert db.get(TrackDraft, draft_id) is None
        route = db.scalar(select(TrackRoute))
        assert route is not None and route.overrides == {"start": "Manual"}


@pytest.mark.parametrize("cleanup_answer", ["n", "y"])
@pytest.mark.parametrize("supplied_name", [False, True])
@pytest.mark.parametrize("owner_kind", ["trail", "hike"])
def test_browser_bundle_resumes_cli_review_without_scraping(
    environments: tuple[Environment, Environment],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    cleanup_answer: str,
    supplied_name: bool,
    owner_kind: str,
) -> None:
    from types import SimpleNamespace

    from knut_vandrar_backend.models.track import TrackCollection, TrackDraft, TrackRoute
    from knut_vandrar_backend.tracks.bundle import BundleSource
    from knut_vandrar_backend.tracks.cli import run

    source, _ = environments
    files = tmp_path / "browser-export"
    files.mkdir()
    names = ["Trail 7A", "Trail 8"]
    references = []
    for index, name in enumerate(names):
        filename = f"{name}.gpx"
        (files / filename).write_text(
            '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'
            + name
            + '</name><trkseg><trkpt lat="1" lon="2"/><trkpt lat="2" lon="3"/></trkseg></trk></gpx>'
        )
        references.append(
            {
                "source_id": str(100 + index),
                "source_order": index,
                "filename": filename,
                "metadata": {"RouteName": name + " ←", "About": "A - B"},
            }
        )
    manifest = files / "plotaroute-20512.json"
    manifest.write_text(
        json.dumps(
            {
                "format": "knut-vandrar-plotaroute",
                "version": 1,
                "collection": {
                    "id": "20512",
                    "url": "https://www.plotaroute.com/routecollection/20512",
                    "name": "Trail",
                    "route_names": [name + " ←" for name in names],
                },
                "routes": references,
            }
        )
    )
    args = SimpleNamespace(
        collection="20512",
        direction="backward",
        bundle_source=BundleSource(manifest),
        name="My collection" if supplied_name else None,
    )

    answers = iter(
        [*([] if supplied_name else ["My collection"]), "e", "3", "Edited start", "", "q"]
    )
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    assert (
        run(
            source.factory,
            source.media,
            LOCATION if owner_kind == "trail" else None,
            "Trail",
            args,
            hike_id=HIKE if owner_kind == "hike" else None,
        )
        == 0
    )
    with source.factory() as db:
        draft = db.scalar(select(TrackDraft))
        assert draft is not None
        assert draft.data["name"] == "My collection"
        assert draft.data["routes"]["100"]["reviewed"]
        assert draft.data["routes"]["100"]["overrides"]["start"] == "Edited start"
        assert not draft.data["routes"]["101"]["reviewed"]
        assert db.scalar(select(func.count()).select_from(TrackCollection)) == 0
    # A resumed draft can recover its temporary files from the original export.
    import shutil

    shutil.rmtree(source.media / ".track-drafts")
    answers = iter([*([] if supplied_name else [""]), "", "s", cleanup_answer])
    assert (
        run(
            source.factory,
            source.media,
            LOCATION if owner_kind == "trail" else None,
            "Trail",
            args,
            hike_id=HIKE if owner_kind == "hike" else None,
        )
        == 0
    )
    with source.factory() as db:
        collection = db.scalar(select(TrackCollection))
        assert collection is not None
        assert collection.name == "My collection"
        assert collection.direction == ("backward" if owner_kind == "trail" else None)
        assert not collection.details["incomplete"]
        assert collection.hike_id == (HIKE if owner_kind == "hike" else None)
        assert collection.location_id == (LOCATION if owner_kind == "trail" else None)
        hike = db.get(Hike, HIKE)
        assert hike is not None
        assert hike.track_collection_id == (collection.id if owner_kind == "hike" else None)
        route = db.scalar(select(TrackRoute).where(TrackRoute.source_id == "100"))
        assert route is not None and route.overrides["start"] == "Edited start"
        assert db.scalar(select(func.count()).select_from(TrackDraft)) == 0

    assert manifest.exists() == (cleanup_answer == "n")
    for reference in references:
        assert (files / str(reference["filename"])).exists() == (cleanup_answer == "n")
    with source.factory() as db:
        for saved_route in db.scalars(select(TrackRoute)):
            from knut_vandrar_backend.tracks.gpx import track_path

            assert track_path(source.media, saved_route.digest).is_file()


@pytest.mark.parametrize("owner_kind", ["trail", "hike"])
def test_hike_collection_selection_and_custom_tracks_transfer_with_mapping(
    environments: tuple[Environment, Environment], owner_kind: str
) -> None:
    from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
    from knut_vandrar_backend.tracks.gpx import store, track_path

    source, destination = environments
    collection_id, route_id = UUID(int=9001), UUID(int=9002)
    mapped_hike, mapped_trail = UUID(int=9010), UUID(int=9011)
    raw = b'<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="2" lon="3"/></trkseg></trk></gpx>'
    digest = store(source.media, raw)
    with source.factory.begin() as db:
        db.add(
            TrackCollection(
                id=collection_id,
                location_id=LOCATION if owner_kind == "trail" else None,
                hike_id=HIKE if owner_kind == "hike" else None,
                source_id="20512",
                name="Selected",
                direction="backward" if owner_kind == "trail" else None,
            )
        )
        db.flush()
        db.add(
            TrackRoute(
                id=route_id,
                collection_id=collection_id,
                source_id="123",
                details={"name": "Stage"},
                overrides={"start": "Manual"},
                digest=digest,
            )
        )
        hike = db.get(Hike, HIKE)
        assert hike is not None
        hike.track_collection_id = collection_id
    with destination.factory.begin() as db:
        db.add(HikingLocation(id=mapped_trail))
        db.flush()
        db.add(Hike(id=mapped_hike, location_id=mapped_trail))
    output = BytesIO()
    with source.factory() as db:
        export_archive(db, source.media, output, hikes=(HIKE,))
    mapping = {"hike_map": {HIKE: mapped_hike}, "location_map": {LOCATION: mapped_trail}}
    dry_run = transfer.import_archive(
        destination.factory,
        destination.media,
        BytesIO(output.getvalue()),
        dry_run=True,
        hike_map=mapping["hike_map"],
        location_map=mapping["location_map"],
    )
    assert not dry_run.conflicts
    with destination.factory() as db:
        assert db.get(TrackCollection, collection_id) is None
    imported = transfer.import_archive(
        destination.factory,
        destination.media,
        BytesIO(output.getvalue()),
        hike_map=mapping["hike_map"],
        location_map=mapping["location_map"],
    )
    assert not imported.conflicts
    with destination.factory() as db:
        collection = db.get(TrackCollection, collection_id)
        hike = db.get(Hike, mapped_hike)
        assert collection is not None and hike is not None
        assert collection.hike_id == (mapped_hike if owner_kind == "hike" else None)
        assert collection.location_id == (mapped_trail if owner_kind == "trail" else None)
        assert hike.track_collection_id == collection_id
        route = db.get(TrackRoute, route_id)
        assert route is not None and route.overrides == {"start": "Manual"}
        assert track_path(destination.media, route.digest).read_bytes() == raw
    repeated = transfer.import_archive(
        destination.factory,
        destination.media,
        BytesIO(output.getvalue()),
        hike_map=mapping["hike_map"],
        location_map=mapping["location_map"],
    )
    assert not repeated.conflicts and repeated.counts["add"] == 0
    assert repeated.counts["replace"] == 0
    # A different destination selection is an ordinary metadata conflict.
    extra_id = UUID(int=9020)
    with destination.factory.begin() as db:
        db.add(
            TrackCollection(
                id=extra_id,
                hike_id=mapped_hike,
                source_id="999",
                name="Destination custom",
                direction=None,
            )
        )
        db.flush()
        hike = db.get(Hike, mapped_hike)
        assert hike is not None
        hike.track_collection_id = extra_id
    conflict = transfer.import_archive(
        destination.factory,
        destination.media,
        BytesIO(output.getvalue()),
        hike_map=mapping["hike_map"],
        location_map=mapping["location_map"],
    )
    assert conflict.counts["conflict"] == 1
    with destination.factory() as db:
        hike = db.get(Hike, mapped_hike)
        assert hike is not None and hike.track_collection_id == extra_id
    replaced = transfer.import_archive(
        destination.factory,
        destination.media,
        BytesIO(output.getvalue()),
        hike_map=mapping["hike_map"],
        location_map=mapping["location_map"],
        replace=True,
    )
    assert not replaced.conflicts
    with destination.factory() as db:
        hike = db.get(Hike, mapped_hike)
        assert hike is not None and hike.track_collection_id == collection_id
        assert db.get(TrackCollection, extra_id) is not None


def test_collection_owner_constraint_rejects_missing_and_double_owner(
    environments: tuple[Environment, Environment],
) -> None:
    from sqlalchemy.exc import IntegrityError

    from knut_vandrar_backend.models.track import TrackCollection

    source, _ = environments
    for location_id, hike_id in ((None, None), (LOCATION, HIKE)):
        with pytest.raises(IntegrityError), source.factory.begin() as db:
            db.add(
                TrackCollection(
                    location_id=location_id,
                    hike_id=hike_id,
                    source_id="1",
                    name="Invalid",
                    direction="forward",
                )
            )


def test_import_target_lookup_matches_partial_names_and_titles_in_all_languages(
    environments: tuple[Environment, Environment],
) -> None:
    from knut_vandrar_backend.models.hike import HikeTranslation
    from knut_vandrar_backend.models.location import LocationTranslation
    from knut_vandrar_backend.tracks.cli import find_targets

    source, _ = environments
    with source.factory.begin() as db:
        db.add(LocationTranslation(location_id=LOCATION, locale_code="en", name="Bergslagsleden"))
        for locale, title in (("en", "Northern adventure"), ("sv", "Nordvandring")):
            db.add(
                HikeTranslation(
                    hike_id=HIKE,
                    locale_code=locale,
                    title=title,
                    summary_markdown="Summary",
                    slug="northern-adventure",
                )
            )
    with source.factory() as db:
        assert find_targets(db, trail="BER", hike=None) == [(LOCATION, "Bergslagsleden")]
        assert find_targets(db, trail="slags", hike=None) == [(LOCATION, "Bergslagsleden")]
        assert [row[0] for row in find_targets(db, trail=None, hike="NOR")] == [HIKE]
        assert [row[0] for row in find_targets(db, trail=None, hike="adven")] == [HIKE]
        assert find_targets(db, trail="%", hike=None) == []
        assert find_targets(db, trail=None, hike="_") == []


def test_generated_maps_round_trip_remap_and_conflict(
    environments: tuple[Environment, Environment],
) -> None:
    from knut_vandrar_backend.maps.assets import Dimensions, MapData, images, persist

    source, destination = environments
    data = MapData(
        fingerprint="a" * 64,
        variants={
            "mobile": Dimensions(width=20, height=10),
            "wide": Dimensions(width=20, height=10),
        },
        provenance={"provider": "OpenFreeMap"},
    )
    content = {key: _image("green", "WEBP") for key in data.variants}
    with source.factory.begin() as db:
        db.execute(delete(Photo))
        persist(db, HIKE, data, content)
    archive = BytesIO()
    with source.factory() as db:
        export_archive(db, source.media, archive)
    archive.seek(0)
    report = transfer.import_archive(destination.factory, destination.media, archive)
    assert not report.conflicts
    with destination.factory() as db:
        rows = images(db, HIKE)
        assert {name: row.content for name, row in rows.items()} == content
        assert all(row.fingerprint == "a" * 64 for row in rows.values())
    archive.seek(0)
    report = transfer.import_archive(destination.factory, destination.media, archive)
    assert report.counts["add"] == report.counts["replace"] == 0
    with destination.factory.begin() as db:
        persist(db, HIKE, data.model_copy(update={"fingerprint": "b" * 64}), content)
    archive.seek(0)
    report = transfer.import_archive(destination.factory, destination.media, archive)
    assert report.conflicts
    archive.seek(0)
    report = transfer.import_archive(destination.factory, destination.media, archive, replace=True)
    assert not report.conflicts
    remapped = uuid4()
    with destination.factory.begin() as db:
        db.add(Hike(id=remapped))
    archive.seek(0)
    transfer.import_archive(
        destination.factory, destination.media, archive, hike_map={HIKE: remapped}, replace=True
    )
    with destination.factory() as db:
        assert len(images(db, remapped)) == 2


def test_single_gpx_import_resume_replacement_and_media_round_trip(
    environments: tuple[Environment, Environment], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from types import SimpleNamespace

    from knut_vandrar_backend.models.track import TrackCollection, TrackRoute
    from knut_vandrar_backend.tracks.cli import run
    from knut_vandrar_backend.tracks.gpx import track_path
    from knut_vandrar_backend.tracks.sources import SingleGpxSource

    source, destination = environments
    path = tmp_path / "single.gpx"
    path.write_text(
        '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>A - B</name>'
        '<trkseg><trkpt lat="59" lon="15"/><trkpt lat="60" lon="16"/></trkseg></trk></gpx>'
    )
    args = SimpleNamespace(
        collection="gpx:single",
        direction=None,
        bundle_source=SingleGpxSource(path),
        name="My route",
    )
    answers = iter(["e", "3", "Edited start", "q"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    assert run(source.factory, source.media, None, "Hike", args, hike_id=HIKE) == 0
    answers = iter(["", "s"])
    assert run(source.factory, source.media, None, "Hike", args, hike_id=HIKE) == 0
    with source.factory() as db:
        collection = db.scalar(select(TrackCollection))
        route = db.scalar(select(TrackRoute))
        assert collection is not None and route is not None
        collection_id, route_id, first_digest = collection.id, route.id, route.digest
        assert route.overrides["start"] == "Edited start"
        hike = db.get(Hike, HIKE)
        assert hike is not None and hike.track_collection_id == collection.id
    # A renamed replacement updates the same logical route and retains editorial overrides.
    replacement = tmp_path / "renamed.gpx"
    replacement.write_text(path.read_text().replace('lat="60"', 'lat="61"'))
    args.bundle_source = SingleGpxSource(replacement)
    answers = iter(["", "s"])
    assert run(source.factory, source.media, None, "Hike", args, hike_id=HIKE) == 0
    assert path.is_file() and replacement.is_file()
    with source.factory() as db:
        route = db.get(TrackRoute, route_id)
        assert route is not None and route.digest != first_digest
        assert route.overrides["start"] == "Edited start"
        assert db.scalar(select(func.count()).select_from(TrackCollection)) == 1
        assert db.scalar(select(func.count()).select_from(TrackRoute)) == 1
        raw = track_path(source.media, route.digest).read_bytes()
    imported = _import(destination, _export(source))
    assert not imported.conflicts
    with destination.factory() as db:
        route = db.get(TrackRoute, route_id)
        hike = db.get(Hike, HIKE)
        assert route is not None and hike is not None
        assert hike.track_collection_id == collection_id
        assert route.source_id == "gpx:single"
        assert track_path(destination.media, route.digest).read_bytes() == raw
