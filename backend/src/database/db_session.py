"""SQLAlchemy engine, declarative base, and request-scoped sessions."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from src.settings import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.sqlalchemy_echo,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
