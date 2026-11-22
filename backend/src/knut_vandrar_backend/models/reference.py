"""Reference data used by localized content and hiking content."""

from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from knut_vandrar_backend.database.base import Base


class Language(Base):
    __tablename__ = "languages"

    code: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_source: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class InfoCardType(Base):
    __tablename__ = "info_card_types"
    __table_args__ = (
        CheckConstraint("sort_order_active >= 0", name="ck_info_card_type_order_active"),
        CheckConstraint("sort_order_finished >= 0", name="ck_info_card_type_order_finished"),
    )

    type: Mapped[str] = mapped_column(String(50), primary_key=True)
    sort_order_active: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    sort_order_finished: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    data_structure: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=False
    )
