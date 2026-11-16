"""Commit receipts used to recover interrupted filesystem/database media imports."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base


class MediaImportReceipt(Base):
    __tablename__ = "media_import_receipts"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
