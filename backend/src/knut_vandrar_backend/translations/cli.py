"""Command-line entry point for the shared retranslation service."""

import argparse
from uuid import UUID

from knut_vandrar_backend.database.session import SessionLocal
from knut_vandrar_backend.translations.queue import (
    queue_outdated_translations as queue_outdated_translations,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Explicitly request translations; saving content never queues work."
    )
    parser.add_argument(
        "--include-outdated", action="store_true", help="Also include missing/outdated translations"
    )
    parser.add_argument("--entity-type", choices=("hike", "location", "region", "achievement"))
    parser.add_argument("--entity-id", type=UUID)
    parser.add_argument("--locale", choices=("sv", "cs"))
    args = parser.parse_args()
    if args.entity_id is not None and args.entity_type is None:
        parser.error("--entity-id requires --entity-type")
    with SessionLocal.begin() as db:
        queued, unchanged = queue_outdated_translations(
            db,
            include_outdated=args.include_outdated,
            entity_type=args.entity_type,
            entity_id=args.entity_id,
            locale=args.locale,
        )
    print(
        f"Queued {queued} translation job(s); {unchanged} translation(s) already queued or running."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
