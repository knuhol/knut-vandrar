"""Derived hike categories, filtered before counting and pagination."""

from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, or_
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.compiler import SQLCompiler
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.functions import FunctionElement
from sqlalchemy.types import Numeric

from knut_vandrar_backend.models.hike import Hike


class ElapsedSeconds(FunctionElement[Decimal]):
    type = Numeric()
    inherit_cache = True


@compiles(ElapsedSeconds, "postgresql")
def _postgres_seconds(element: ElapsedSeconds, compiler: SQLCompiler, **kwargs: Any) -> str:
    end, start = element.clauses
    return f"EXTRACT(EPOCH FROM ({compiler.process(end, **kwargs)} - {compiler.process(start, **kwargs)}))"


@compiles(ElapsedSeconds, "sqlite")
def _sqlite_seconds(element: ElapsedSeconds, compiler: SQLCompiler, **kwargs: Any) -> str:
    end, start = element.clauses
    return f"((julianday({compiler.process(end, **kwargs)}) - julianday({compiler.process(start, **kwargs)})) * 86400)"


def long_distance_condition() -> ColumnElement[bool]:
    start = case((Hike.status == "planned", Hike.planned_start_at), else_=Hike.actual_start_at)
    end = case(
        (Hike.status == "planned", Hike.planned_end_at),
        (Hike.status == "ongoing", func.coalesce(Hike.actual_end_at, func.now())),
        else_=Hike.actual_end_at,
    )
    # Displayed duration rounds up: five days means more than four elapsed days.
    return or_(
        func.coalesce(Hike.distance_km, 0) >= 100,
        func.coalesce(ElapsedSeconds(end, start), 0) > 4 * 86400,
    )
