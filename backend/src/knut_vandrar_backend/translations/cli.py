"""Command-line entry point for the shared retranslation service."""

from knut_vandrar_backend.database.session import SessionLocal
from knut_vandrar_backend.translations.queue import (
    queue_outdated_translations as queue_outdated_translations,
)


def main() -> int:
    with SessionLocal.begin() as db:
        queued, unchanged = queue_outdated_translations(db)
    print(
        f"Queued {queued} translation job(s); {unchanged} flagged translation(s) already queued or running."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
