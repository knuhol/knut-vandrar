"""Docker/SSH-friendly media commands; archive bytes use stdin/stdout exclusively."""

import argparse
import sqlite3
import sys
import tarfile
from uuid import UUID

from fastapi import HTTPException
from PIL.Image import DecompressionBombError, DecompressionBombWarning
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from knut_vandrar_backend.media.archive import MediaError, export_archive
from knut_vandrar_backend.media.covers import backfill_desktop_covers
from knut_vandrar_backend.media.progress import Progress
from knut_vandrar_backend.media.recovery import recover_transfers, transfer_lock
from knut_vandrar_backend.media.schema import DEFAULT_MAX_BYTES
from knut_vandrar_backend.media.transfer import import_archive


def _mapping(value: str) -> tuple[UUID, UUID]:
    try:
        source, destination = value.split("=", 1)
        return UUID(source), UUID(destination)
    except ValueError as error:
        raise argparse.ArgumentTypeError("Expected SOURCE_UUID=DESTINATION_UUID") from error


def _unique_mapping(values: list[tuple[UUID, UUID]]) -> dict[UUID, UUID]:
    result = dict(values)
    if len(result) != len(values):
        raise MediaError("Each mapping source may be specified only once")
    return result


def _resolve_hikes(db: Session, values: list[str]) -> tuple[UUID, ...]:
    from knut_vandrar_backend.tracks.cli import find_targets

    identifiers = []
    for value in values:
        try:
            identifier = UUID(value)
        except ValueError:
            title = value.strip()
            if not title:
                raise MediaError("Hike title must not be empty") from None
            matches = find_targets(db, trail=None, hike=title)
            if not matches:
                raise MediaError(f"No hike matches: {value}") from None
            if len(matches) > 1:
                candidates = "; ".join(f"{name} ({key})" for key, name in matches)
                raise MediaError(
                    f"Ambiguous hike title: {value}. Use a UUID: {candidates}"
                ) from None
            identifier = matches[0][0]
        identifiers.append(identifier)
    return tuple(dict.fromkeys(identifiers))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transfer images, GPX files, and metadata between environments"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    export = commands.add_parser("export", help="Write a portable tar archive to stdout")
    export.add_argument(
        "--hike",
        action="append",
        default=[],
        metavar="UUID_OR_TITLE",
        help="UUID or case-insensitive partial title in any supported language",
    )
    export.add_argument("--location", type=UUID, action="append", default=[])
    importer = commands.add_parser("import", help="Read a portable tar archive from stdin")
    importer.add_argument("--dry-run", action="store_true")
    importer.add_argument(
        "--replace", action="store_true", help="Replace conflicting image/metadata values"
    )
    importer.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES)
    importer.add_argument("--map-hike", type=_mapping, action="append", default=[])
    importer.add_argument("--map-location", type=_mapping, action="append", default=[])
    commands.add_parser("recover", help="Recover an interrupted import without reading an archive")
    commands.add_parser("backfill-desktop-covers", help="Generate missing desktop and wide covers")
    args = parser.parse_args()
    if args.command == "import" and args.max_bytes <= 0:
        parser.error("--max-bytes must be positive")
    # Help/argument validation do not require application credentials.
    from knut_vandrar_backend.database.session import SessionLocal
    from knut_vandrar_backend.settings import settings

    progress_stream = sys.stderr if args.command == "export" else sys.stdout
    progress = Progress(lambda message: print(message, file=progress_stream, flush=True))
    try:
        if args.command == "export":
            with transfer_lock(settings.media_root) as transfers, SessionLocal.begin() as db:
                if any(path.name != "lock" for path in transfers.iterdir()):
                    raise MediaError("Recover interrupted imports before exporting media")
                count = export_archive(
                    db,
                    settings.media_root,
                    sys.stdout.buffer,
                    hikes=_resolve_hikes(db, args.hike),
                    locations=tuple(args.location),
                    progress=progress,
                )
            print(f"Exported {count} assets.", file=sys.stderr)
        elif args.command == "backfill-desktop-covers":
            print(
                f"Generated {backfill_desktop_covers(SessionLocal)} desktop and wide cover sets.",
                flush=True,
            )
        elif args.command == "recover":
            with transfer_lock(settings.media_root) as transfers:
                count = recover_transfers(SessionLocal, settings.media_root, transfers)
            print(f"Recovered {count} interrupted imports.", file=sys.stderr)
        else:
            report = import_archive(
                SessionLocal,
                settings.media_root,
                sys.stdin.buffer,
                dry_run=args.dry_run,
                replace=args.replace,
                max_bytes=args.max_bytes,
                hike_map=_unique_mapping(args.map_hike),
                location_map=_unique_mapping(args.map_location),
                progress=progress,
            )
            prefix = (
                "Dry run" if args.dry_run else "Import blocked" if report.conflicts else "Imported"
            )
            counts = ", ".join(
                f"{report.counts[key]} {key}"
                for key in ("add", "replace", "repair", "skip", "conflict")
            )
            print(f"{prefix}: {counts}.", flush=True)
            for conflict in report.conflicts:
                print(conflict, file=sys.stderr)
            if report.counts["conflict"]:
                print(
                    "No changes applied. Use --replace to resolve reported conflicts.",
                    file=sys.stderr,
                )
                return 1
    except SQLAlchemyError:
        print(
            "Database operation failed. Verify the selected environment and migrations; "
            "run --recover before retrying an interrupted import.",
            file=sys.stderr,
        )
        return 1
    except (
        MediaError,
        ValidationError,
        tarfile.TarError,
        OSError,
        sqlite3.Error,
        ValueError,
        HTTPException,
        DecompressionBombError,
        DecompressionBombWarning,
    ) as error:
        print(f"Media transfer failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
