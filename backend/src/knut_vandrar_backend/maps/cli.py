"""Manually generate all responsive map variants for selected hikes."""

import argparse
import hashlib
import json
import os
import subprocess
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Any
from uuid import UUID

from PIL import Image
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.maps.assets import MapData, images, persist
from knut_vandrar_backend.maps.config import ROOT, fingerprint, load_config
from knut_vandrar_backend.maps.geometry import route_data
from knut_vandrar_backend.maps.progress import split_at_stop
from knut_vandrar_backend.models.enums import HikeStatus
from knut_vandrar_backend.models.hike import Hike, HikeTranslation
from knut_vandrar_backend.models.location import LocationTerrain
from knut_vandrar_backend.tracks.cli import ask, choose, find_targets


def generate(
    factory: sessionmaker[Session],
    media_root: Path,
    hike_id: UUID,
    *,
    force: bool = False,
    check: bool = False,
    labels: str | None = None,
    terrain: str | None = None,
    preview_output: Path | None = None,
) -> str:
    config, style, tokens = load_config()
    illustration = dict(config["illustration"])
    illustration["profile"] = labels if labels is not None else illustration["profile"]
    terrain = "combined" if terrain is None else terrain
    if illustration["profile"] not in ("auto", "overview", "detail"):
        raise ValueError("Invalid map label profile")
    if terrain not in ("none", "hillshade", "contours", "combined"):
        raise ValueError("Invalid terrain mode")

    def retrieve(db: Session, hike: Hike) -> dict[str, Any]:
        route = route_data(
            db,
            hike,
            media_root,
            config["render"]["circularThresholdMetres"],
            include_remaining=hike.status == HikeStatus.ABORTED and hike.stop_latitude is not None,
        )
        stop = None
        if hike.status == HikeStatus.ABORTED and hike.stop_latitude is not None:
            if hike.stop_longitude is None:
                raise ValueError("Stopping coordinates must be supplied as a pair")
            stop = {
                "latitude": float(hike.stop_latitude),
                "longitude": float(hike.stop_longitude),
                "stage": hike.stop_stage,
            }
            route = split_at_stop(
                route,
                latitude=float(hike.stop_latitude),
                longitude=float(hike.stop_longitude),
                stage=hike.stop_stage,
            )
        route["inputs"]["presentation"] = {
            "illustration": {
                **illustration,
                "terrainTypes": sorted(
                    db.scalars(
                        select(LocationTerrain.terrain).where(
                            LocationTerrain.location_id == hike.location_id
                        )
                    )
                )
                if hike.location_id is not None
                else [],
            },
            "terrain": terrain,
            "stop": stop,
        }
        return route

    with factory() as db:
        hike = db.get(Hike, hike_id)
        if hike is None:
            raise ValueError("Hike no longer exists")
        route = retrieve(db, hike)
        illustration = route["inputs"]["presentation"]["illustration"]
        identity = fingerprint(route["inputs"])
        rows = images(db, hike_id)
        current = set(rows) == set(config["variants"]) and all(
            row.fingerprint == identity
            and hashlib.sha256(row.content).hexdigest() == row.sha256
            and (row.width, row.height)
            == (config["variants"][key]["width"], config["variants"][key]["height"])
            for key, row in rows.items()
        )
        if current and not force and preview_output is None:
            return "up to date"
    if check:
        return "needs generation"
    if os.getenv("MAPS_OPENFREEMAP_PERMISSION_CONFIRMED", "").lower() != "true":
        raise ValueError(
            "OpenFreeMap automated static rendering permission is unconfirmed; see docs/static-maps.md"
        )
    with TemporaryDirectory(prefix="vandrar-maps-") as directory:
        job = {
            "config": config,
            "style": style,
            "tokens": tokens,
            "route": route,
            "output": directory,
            "illustration": illustration,
            "country": json.loads((ROOT / "maps/data/sweden.geojson").read_text()),
        }
        if terrain != "none":
            job["topography"] = {
                "settings": json.loads((ROOT / "maps/topography.json").read_text()),
                "mode": terrain,
            }
        subprocess.run(
            ["node", str(ROOT / "tools/maps/render.mjs")],
            input=json.dumps(job).encode(),
            check=True,
            timeout=(config["render"]["timeoutMs"] / 1000 * 4 + 30) * len(config["variants"]),
            cwd=ROOT,
        )
        content = {}
        for name, dimensions in config["variants"].items():
            with Image.open(Path(directory) / f"{name}.png") as image:
                if image.size != (dimensions["width"], dimensions["height"]):
                    raise ValueError("Renderer returned unexpected dimensions")
                output = BytesIO()
                image.convert("RGB").save(
                    output, "WEBP", quality=config["render"]["webpQuality"], method=6
                )
                content[name] = output.getvalue()
        data = MapData(
            fingerprint=identity,
            variants=config["variants"],
            provenance={
                "generated_at": datetime.now(UTC).isoformat(),
                "inputs": route["inputs"],
                "provider": config["provider"]["name"],
                "attribution": config["attribution"]
                + (
                    " · " + job["topography"]["settings"]["provider"]["attribution"]
                    if "topography" in job
                    else ""
                ),
                "illustration": illustration,
                "terrain": terrain,
                "stop": route.get("stop"),
                "variant_attributions": {
                    name: json.loads((Path(directory) / f"{name}-layout.json").read_text()).get(
                        "attribution"
                    )
                    for name in config["variants"]
                    if (Path(directory) / f"{name}-layout.json").is_file()
                },
            },
        )
        if preview_output is not None:
            destination = preview_output.expanduser().resolve() / str(hike_id)
            destination.mkdir(parents=True, exist_ok=True)
            for name, image_bytes in content.items():
                (destination / f"{name}.webp").write_bytes(image_bytes)
            for report in Path(directory).glob("*.json"):
                (destination / report.name).write_bytes(report.read_bytes())
            (destination / "provenance.json").write_text(
                json.dumps(data.provenance, ensure_ascii=False, indent=2) + "\n"
            )
            print(f"  Preview images: {destination}", flush=True)
            return "preview generated (stored maps unchanged)"
        # Serialize publication with transfers, then recheck inputs under the hike lock.
        from knut_vandrar_backend.media.recovery import transfer_lock

        with transfer_lock(media_root), factory.begin() as db:
            hike = db.scalar(select(Hike).where(Hike.id == hike_id).with_for_update())
            if hike is None:
                raise ValueError("Hike no longer exists")
            latest = retrieve(db, hike)
            if fingerprint(latest["inputs"]) != identity:
                raise ValueError("Map inputs changed during rendering; previous maps retained")
            persist(db, hike_id, data, content)
    return "generated"


def export_images(factory: sessionmaker[Session], hike_id: UUID, output: Path) -> None:
    """Write inspectable copies without exposing map images through the website."""
    destination = output.expanduser().resolve() / str(hike_id)
    destination.mkdir(parents=True, exist_ok=True)
    with factory() as db:
        for name, row in images(db, hike_id).items():
            with NamedTemporaryFile(dir=destination, delete=False) as temporary:
                path = Path(temporary.name)
                try:
                    temporary.write(row.content)
                    temporary.flush()
                    os.fsync(temporary.fileno())
                    os.replace(path, destination / f"{name}.webp")
                finally:
                    path.unlink(missing_ok=True)
    print(f"  Image copies: {destination}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--hike", help="Case-insensitive partial title in any supported language")
    target.add_argument("--all", action="store_true", help="Select every hike")
    parser.add_argument("--force", action="store_true", help="Regenerate current images too")
    parser.add_argument(
        "--check", action="store_true", help="Report freshness without rendering or writing"
    )
    parser.add_argument(
        "--output-dir", type=Path, help="Also export image copies under DIRECTORY/<hike-uuid>/"
    )
    parser.add_argument(
        "--labels",
        choices=("auto", "overview", "detail"),
        default=None,
        help="Geographical label detail; auto uses the location's terrain classification",
    )
    parser.add_argument(
        "--terrain",
        choices=("none", "hillshade", "contours", "combined"),
        default=None,
        help="Terrain treatment (default: combined)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Render review copies only; requires --output-dir; leaves DB unchanged",
    )
    args = parser.parse_args()
    if args.preview and (args.output_dir is None or args.check):
        parser.error("--preview requires --output-dir and cannot be combined with --check")
    return args


def main() -> int:
    args = parse_args()
    try:
        if not args.hike and not args.all:
            args.all = ask("Generate maps for (hike/all)", choices=("hike", "all")) == "all"
            if not args.all:
                args.hike = ask("Partial hike title")
            if not args.force and not args.check and not args.preview:
                args.force = (
                    ask("Regenerate up-to-date maps (yes/no)", default="no", choices=("yes", "no"))
                    == "yes"
                )
            if not args.check:
                if args.labels is None:
                    args.labels = ask(
                        "Label detail (auto/overview/detail)",
                        default="auto",
                        choices=("auto", "overview", "detail"),
                    )
                if args.terrain is None:
                    args.terrain = ask(
                        "Terrain (combined/hillshade/contours/none)",
                        default="combined",
                        choices=("combined", "hillshade", "contours", "none"),
                    )
                if not args.preview:
                    args.preview = (
                        ask(
                            "Output (preview/store)",
                            default="preview",
                            choices=("preview", "store"),
                        )
                        == "preview"
                    )
                if args.output_dir is None:
                    args.output_dir = Path(ask("Image output directory", default="backups/maps"))
        from knut_vandrar_backend.database.session import SessionLocal
        from knut_vandrar_backend.settings import settings

        with SessionLocal() as db:
            if args.all:
                targets = [
                    (row.id, row.title or str(row.id))
                    for row in db.execute(
                        select(Hike.id, HikeTranslation.title)
                        .outerjoin(
                            HikeTranslation,
                            (HikeTranslation.hike_id == Hike.id)
                            & (HikeTranslation.locale_code == "en"),
                        )
                        .order_by(Hike.id)
                    )
                ]
            else:
                targets = find_targets(db, trail=None, hike=args.hike)
                english = dict(
                    db.execute(
                        select(HikeTranslation.hike_id, HikeTranslation.title).where(
                            HikeTranslation.locale_code == "en"
                        )
                    ).all()
                )
                targets = [
                    (identifier, english.get(identifier) or str(identifier))
                    for identifier, _ in targets
                ]
                targets.sort(key=lambda item: (item[1].casefold(), str(item[0])))
                if len(targets) > 1:
                    for i, (identifier, title) in enumerate(targets, 1):
                        print(f"{i}. {title} ({identifier})")
                    targets = [targets[choose("Select hike: ", len(targets))]]
        if not targets:
            print("No hikes match.")
            return 1
        failed = 0
        counts: dict[str, int] = {}
        for index, (identifier, title) in enumerate(targets, 1):
            print(f"[{index}/{len(targets)}] {title}", flush=True)
            try:
                status = generate(
                    SessionLocal,
                    settings.media_root,
                    identifier,
                    force=args.force,
                    check=args.check,
                    labels=args.labels,
                    terrain=args.terrain,
                    preview_output=args.output_dir if args.preview else None,
                )
                if args.output_dir is not None and not args.check and not args.preview:
                    export_images(SessionLocal, identifier, args.output_dir)
            except SQLAlchemyError:
                failed += 1
                status = (
                    "skipped: database unavailable or migration 019_hike_stopping_point is missing"
                )
            except (ValueError, OSError, KeyError, subprocess.SubprocessError) as error:
                failed += 1
                status = f"skipped: {error}"
            print(f"  {status}", flush=True)
            key = "failed/skipped" if status.startswith("skipped:") else status
            counts[key] = counts.get(key, 0) + 1
        print("Summary: " + ", ".join(f"{count} {key}" for key, count in counts.items()))
        return 1 if failed else 0
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled. Previously stored maps are retained.")
        return 130
    except SQLAlchemyError:
        print(
            "Map generation stopped: database unavailable or migration 019_hike_stopping_point is missing"
        )
        return 1
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"Map generation stopped: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
