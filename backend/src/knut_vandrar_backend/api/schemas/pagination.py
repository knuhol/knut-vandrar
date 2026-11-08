"""Shared list response and pagination parameters."""

from typing import Annotated

from fastapi import Query
from pydantic import BaseModel

Limit = Annotated[int, Query(ge=1, le=100, description="Maximum entries to return")]
Offset = Annotated[int, Query(ge=0, description="Number of entries to skip")]


class Page[Item](BaseModel):
    items: list[Item]
    total: int
    limit: int
    offset: int
