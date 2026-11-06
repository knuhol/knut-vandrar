"""Fixed database-backed enum values."""

from enum import StrEnum


class HikeStatus(StrEnum):
    PLANNED = "planned"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    ABORTED = "aborted"


class TrailType(StrEnum):
    MOUNTAINS = "mountains"
    LOWLANDS = "lowlands"


class TranslationReviewStatus(StrEnum):
    SOURCE = "source"
    UNREVIEWED = "unreviewed"
    APPROVED = "approved"
    NEEDS_RETRANSLATION = "needs_retranslation"
