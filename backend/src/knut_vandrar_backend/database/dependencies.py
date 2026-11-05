"""FastAPI dependencies for database sessions."""

from collections.abc import Generator

from sqlalchemy.orm import Session

from knut_vandrar_backend.database.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Yield one database session per request and always close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
