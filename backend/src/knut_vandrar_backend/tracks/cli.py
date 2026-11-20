"""Interactive stage-by-stage track review with durable checkpoints."""

import argparse
import copy
import shutil
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.enums import LocationKind
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.models.location import HikingLocation, LocationTranslation
from knut_vandrar_backend.models.track import TrackCollection, TrackDraft, TrackRoute
from knut_vandrar_backend.tracks.bundle import BundleSource, collection_id, offer_download_cleanup
from knut_vandrar_backend.tracks.gpx import store, track_path
from knut_vandrar_backend.tracks.service import FIELDS, ingest, publish, save_draft
from knut_vandrar_backend.tracks.sources import SingleGpxSource


def choose(prompt: str, count: int) -> int:
    while True:
        value = input(prompt).strip()
        if value.isdigit() and 1 <= int(value) <= count:
            return int(value) - 1
        print(f"Enter a number from 1 to {count}.")


def ask(label: str, *, default: str | None = None, choices: tuple[str, ...] = ()) -> str:
    while True:
        value = input(f"{label}" + (f" [{default}]" if default is not None else "") + ": ").strip()
        if not value and default is not None:
            return default
        if value and (not choices or value.lower() in choices):
            return value.lower() if choices else value
        print(f"Choose {' or '.join(choices)}." if choices else "Enter a value.")


def collection_name(value: str) -> str:
    value = value.strip()
    if not value or len(value) > 300:
        raise ValueError("Collection name must contain 1 to 300 characters")
    return value


def ask_name(label: str, default: str | None = None) -> str:
    while True:
        try:
            return collection_name(ask(label, default=default))
        except ValueError as error:
            print(error)


def review(data: dict[str, Any], checkpoint: Any) -> bool:
    # Plotaroute's itinerary is authoritative, independent of direction or stage labels.
    routes = sorted(data["routes"].values(), key=lambda route: route["details"]["source_order"])
    current = next((i for i, r in enumerate(routes) if not r["reviewed"]), len(routes))
    while True:
        if current == len(routes):
            print(f"\nReviewed {len(routes)} stages; {len(data['errors'])} download failures.")
            command = (
                input("[s] Save import  [r] Review again  [c] Collection details  [q] Pause: ")
                .strip()
                .lower()
            )
            if command == "s":
                return True
            if command == "q":
                return False
            if command == "r" and routes:
                current = choose("Stage position: ", len(routes))
            if command == "c":
                name = ask_name("Collection name", data["name"])
                direction = (
                    input(f"Direction [{data['direction']}] (forward/backward): ").strip()
                    if data.get("direction") is not None
                    else None
                )
                if name:
                    data["name"] = name
                if direction in ("forward", "backward"):
                    data["direction"] = direction
                checkpoint()
                continue
            continue
        route = routes[current]
        values = {**route["details"], **route["overrides"]}
        print(f"\nStage {current + 1} of {len(routes)} — {values['name']}")
        for index, field in enumerate(FIELDS, 1):
            print(f"{index}. {field}: {values.get(field) or '—'}")
        print("Order in source:", route["details"]["source_order"] + 1)
        source = values.get("source", {})
        print("Distance:", source.get("Distance", "—"), "Ascent:", source.get("Ascent", "—"))
        command = input("[e] Edit  [Enter] Accept/next  [b] Back  [q] Pause: ").strip().lower()
        if command == "q":
            return False
        if command == "b":
            current = max(0, current - 1)
        elif command == "e":
            field = FIELDS[choose("Field number: ", len(FIELDS))]
            value: Any = input(f"{field} [{values.get(field) or ''}] (clear: /clear): ").strip()
            if not value:
                continue
            if value == "/clear":
                if field not in ("start", "end"):
                    print("Only optional endpoints can be cleared.")
                    continue
                value = None
            elif len(value) > 300:
                print("Maximum length is 300 characters.")
                continue
            route["overrides"][field] = value
            route["reviewed"] = False
            checkpoint()
        elif command == "":
            route["reviewed"] = True
            checkpoint()
            current += 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--trail", help="Partial existing trail name (case-insensitive)")
    target.add_argument("--hike", help="Partial existing hike title (case-insensitive)")
    parser.add_argument("--collection", type=collection_id)
    parser.add_argument(
        "--name", type=collection_name, help="Collection name; prompted when omitted"
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--bundle", type=Path, help="JSON export from the browser extension")
    source.add_argument("--gpx", type=Path, help="Single GPX 1.1 track or route file")
    parser.add_argument("--gpx-dir", type=Path, help="Directory containing the exported GPX files")
    parser.add_argument(
        "--direction",
        choices=("forward", "backward"),
        help="Required for --trail; not applicable to --hike",
    )
    args = parser.parse_args()
    if args.hike and args.direction is not None:
        parser.error("--direction applies only to --trail")
    if args.gpx is not None and (args.collection is not None or args.gpx_dir is not None):
        parser.error("--collection and --gpx-dir apply only to --bundle")
    return args


def complete_args(args: argparse.Namespace) -> argparse.Namespace:
    if args.trail is None and args.hike is None:
        target = ask("Attach collection to (trail/hike)", choices=("trail", "hike"))
        setattr(
            args,
            target,
            ask(f"Partial {target} name" if target == "trail" else "Partial hike title"),
        )
    if args.hike is not None and args.direction is not None:
        raise ValueError("--direction applies only to --trail")
    if args.bundle is None and args.gpx is None:
        path = Path(ask("Path to exported JSON bundle or single GPX file"))
        if path.suffix.lower() == ".gpx":
            args.gpx = path
        else:
            args.bundle = path
    if args.gpx is not None:
        if args.collection is not None or args.gpx_dir is not None:
            raise ValueError("--collection and --gpx-dir apply only to --bundle")
        args.gpx = args.gpx.expanduser()
        args.bundle_source = SingleGpxSource(args.gpx)
        args.collection = args.bundle_source.identifier
        if args.trail is not None and args.direction is None:
            args.direction = ask(
                "Trail direction (forward/backward)", choices=("forward", "backward")
            )
        return args
    args.bundle = args.bundle.expanduser()
    if args.gpx_dir is not None:
        args.gpx_dir = args.gpx_dir.expanduser()
    source = BundleSource(args.bundle, args.gpx_dir)
    if args.gpx_dir is None:
        args.gpx_dir = Path(ask("GPX directory", default=str(source.directory))).expanduser()
        source.directory = args.gpx_dir.resolve()
    if args.collection is None:
        while True:
            try:
                identifier = collection_id(
                    ask("Plotaroute collection ID or URL", default=source.identifier)
                )
                if identifier != source.identifier:
                    raise ValueError("Collection ID must match the exported bundle")
                args.collection = identifier
                break
            except ValueError as error:
                print(error)
    elif args.collection != source.identifier:
        raise ValueError("--collection differs from the browser export")
    if args.trail is not None and args.direction is None:
        args.direction = ask("Trail direction (forward/backward)", choices=("forward", "backward"))
    args.bundle_source = source
    return args


def find_targets(db: Session, *, trail: str | None, hike: str | None) -> list[tuple[UUID, str]]:
    if hike is not None:
        query = (
            select(Hike.id, HikeTranslation.title)
            .join(HikeTranslation, HikeTranslation.hike_id == Hike.id)
            .where(HikeTranslation.title.icontains(hike, autoescape=True))
            .order_by(HikeTranslation.title, Hike.id)
        )
    else:
        query = (
            select(HikingLocation.id, LocationTranslation.name)
            .join(LocationTranslation, LocationTranslation.location_id == HikingLocation.id)
            .where(
                HikingLocation.kind == LocationKind.TRAIL,
                LocationTranslation.name.icontains(trail or "", autoescape=True),
            )
            .order_by(LocationTranslation.name, HikingLocation.id)
        )
    return list({identifier: (identifier, name) for identifier, name in db.execute(query)}.values())


def main() -> int:
    args = parse_args()
    try:
        args = complete_args(args)
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled. Existing saved reviews are unchanged.")
        return 0
    except (ValueError, OSError) as error:
        print(f"Import stopped: {error}")
        return 2
    from knut_vandrar_backend.database.session import SessionLocal
    from knut_vandrar_backend.media.recovery import transfer_lock
    from knut_vandrar_backend.settings import settings

    try:
        with SessionLocal() as db:
            choices = find_targets(db, trail=args.trail, hike=args.hike)
        target_name = "hike" if args.hike else "trail"
        if not choices:
            print(f"No existing {target_name}s match that name.")
            return 1
        for index, (identifier, name) in enumerate(choices, 1):
            print(f"{index}. {name} ({identifier})")
        owner_id, name = choices[choose(f"Select {target_name}: ", len(choices))]
        # Serialize draft editing and media publication with the existing media lock.
        with transfer_lock(settings.media_root):
            return run(
                SessionLocal,
                settings.media_root,
                None if args.hike else owner_id,
                name,
                args,
                hike_id=owner_id if args.hike else None,
            )
    except (KeyboardInterrupt, EOFError):
        print("\nStopped. Any saved review progress is kept.")
        return 0
    except (ValueError, OSError) as error:
        print(f"Import stopped: {error}")
        return 1


def run(
    factory: Any,
    media_root: Path,
    location_id: UUID | None,
    name: str,
    args: Any,
    *,
    hike_id: UUID | None = None,
) -> int:
    if (location_id is None) == (hike_id is None):
        raise ValueError("Choose exactly one trail or hike owner")
    with factory.begin() as db:
        owner = db.get(Hike, hike_id) if hike_id else db.get(HikingLocation, location_id)
        if owner is None or (
            isinstance(owner, HikingLocation) and owner.kind != LocationKind.TRAIL
        ):
            raise ValueError("Destination trail or hike not found")
        draft = db.scalar(
            select(TrackDraft).where(
                TrackDraft.location_id == location_id,
                TrackDraft.hike_id == hike_id,
                TrackDraft.source_id == args.collection,
            )
        )
        resuming = draft is not None
        if draft is None:
            collection = db.scalar(
                select(TrackCollection).where(
                    TrackCollection.location_id == location_id,
                    TrackCollection.hike_id == hike_id,
                    TrackCollection.source_id == args.collection,
                )
            )
            routes = {}
            if collection:
                for route in db.scalars(
                    select(TrackRoute).where(TrackRoute.collection_id == collection.id)
                ):
                    routes[route.source_id] = {
                        "details": route.details,
                        "overrides": route.overrides,
                        "digest": route.digest,
                        "reviewed": True,
                    }
            data: dict[str, Any] = {
                "name": getattr(args, "name", None)
                or ask_name(f"Collection name for {name}", collection.name if collection else None),
                "direction": args.direction if location_id else None,
                "routes": routes,
                "seen": [],
                "errors": {},
                "discovered": False,
            }
            draft = TrackDraft(
                location_id=location_id, hike_id=hike_id, source_id=args.collection, data=data
            )
            db.add(draft)
            db.flush()
        draft_id = draft.id
        data = copy.deepcopy(draft.data)
        if resuming:
            data["name"] = getattr(args, "name", None) or ask_name("Collection name", data["name"])
        if hike_id is not None:
            data["direction"] = None
    staging = media_root / ".track-drafts" / str(draft_id)
    if staging.is_symlink() or staging.parent.is_symlink():
        raise ValueError("Unsafe draft staging path")
    staging.mkdir(parents=True, exist_ok=True, mode=0o700)

    def checkpoint() -> None:
        save_draft(factory, draft_id, data)

    source = args.bundle_source
    data["errors"] = {}
    data["seen"] = []
    for item in source.read(args.collection):
        ingest(data, item, staging)
        if "path" in item:
            print(f"Imported route {item['source_id']}.")
        if "error" in item:
            print(item["source_id"], item["error"])
        checkpoint()
    data["discovered"] = True
    removed = (
        set(data["routes"]) - set(data["seen"]) if data.get("membership_complete", True) else set()
    )
    if removed:
        print("Routes absent from source collection (retained):", ", ".join(sorted(removed)))
    checkpoint()
    # Rebuild draft files from the supplied bundle first. Only retained routes
    # absent from that bundle need to fall back to their published bytes.
    for route in data["routes"].values():
        if not track_path(staging, route["digest"]).exists():
            published = track_path(media_root, route["digest"])
            if not published.is_file():
                raise ValueError(
                    f"Missing draft GPX for {route['details']['name']}; restore its original download"
                )
            store(staging, published.read_bytes())
    if not data["routes"]:
        print("No routes imported. Check the exported files and rerun.")
        return 1
    if not review(data, checkpoint):
        print("Paused. Draft saved.")
        return 0
    checkpoint()
    with factory.begin() as db:
        owner = db.get(Hike, hike_id) if hike_id else db.get(HikingLocation, location_id)
        if owner is None or (
            isinstance(owner, HikingLocation) and owner.kind != LocationKind.TRAIL
        ):
            raise ValueError("Destination trail or hike not found")
        draft = db.get(TrackDraft, draft_id)
        if draft is None:
            raise ValueError("Draft no longer exists")
        publish(db, draft, staging, media_root)
    print("Collection saved. Pictures and tracks transfer together using media-export/import.")
    try:
        shutil.rmtree(staging)
    except OSError:
        print("Could not remove temporary draft files; the collection is saved.")
    if isinstance(source, SingleGpxSource):
        print("Original GPX file kept.")
    elif not data["errors"] and data.get("membership_complete", True):
        offer_download_cleanup(source, protected_root=media_root)
    else:
        print("Downloaded files kept so the incomplete import can be retried.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
