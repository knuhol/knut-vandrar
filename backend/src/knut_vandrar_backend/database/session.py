"""SQLAlchemy engine and request-scoped session factory."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from knut_vandrar_backend.settings import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker[Session](bind=engine, autoflush=False)
