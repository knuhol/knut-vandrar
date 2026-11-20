"""Map persistence and portable archive adapters using existing binary-image storage."""

import hashlib
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from knut_vandrar_backend.models.map import HikeMapImage


class Dimensions(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    width: int = Field(gt=0, le=10000)
    height: int = Field(gt=0, le=10000)

    @model_validator(mode="after")
    def bounded_pixels(self) -> "Dimensions":
        if self.width * self.height > 40_000_000:
            raise ValueError("Map variant exceeds 40 megapixels")
        return self


class MapData(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    variants: dict[str, Dimensions] = Field(min_length=1, max_length=20)
    provenance: dict[str, Any]


def images(db: Session, hike_id: UUID) -> dict[str, HikeMapImage]:
    return {
        row.variant: row
        for row in db.scalars(select(HikeMapImage).where(HikeMapImage.hike_id == hike_id))
    }


def metadata(rows: dict[str, HikeMapImage]) -> dict[str, Any]:
    first = next(iter(rows.values()))
    if any(
        row.fingerprint != first.fingerprint or row.provenance != first.provenance
        for row in rows.values()
    ):
        raise ValueError("Inconsistent map image generation")
    return MapData(
        fingerprint=first.fingerprint,
        variants={key: Dimensions(width=row.width, height=row.height) for key, row in rows.items()},
        provenance=first.provenance,
    ).model_dump()


def persist(db: Session, hike_id: UUID, data: MapData, content: dict[str, bytes]) -> None:
    if set(content) != set(data.variants):
        raise ValueError("Incomplete map generation")
    existing = images(db, hike_id)
    for variant, value in content.items():
        row = existing.get(variant)
        if row is None:
            row = HikeMapImage(hike_id=hike_id, variant=variant)
            db.add(row)
        row.content = value
        row.sha256 = hashlib.sha256(value).hexdigest()
        row.fingerprint = data.fingerprint
        row.provenance = data.provenance
        row.width, row.height = data.variants[variant].width, data.variants[variant].height
    db.execute(
        delete(HikeMapImage).where(
            HikeMapImage.hike_id == hike_id, HikeMapImage.variant.not_in(content)
        )
    )
    db.flush()
