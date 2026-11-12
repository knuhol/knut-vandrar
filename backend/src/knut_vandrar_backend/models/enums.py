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
    COASTAL = "coastal"


class TranslationReviewStatus(StrEnum):
    MANUAL = "manual"
    SOURCE = "source"
    UNREVIEWED = "unreviewed"
    APPROVED = "approved"
    NEEDS_RETRANSLATION = "needs_retranslation"


class LocationKind(StrEnum):
    TRAIL = "trail"
    AREA = "area"


class Waymarking(StrEnum):
    WAYMARKED = "waymarked"
    PARTLY_WAYMARKED = "partly_waymarked"
    UNMARKED = "unmarked"


class ArcticCirclePosition(StrEnum):
    SOUTH = "south"
    CROSSES = "crosses"
    NORTH = "north"


class InformationStatus(StrEnum):
    UNKNOWN = "unknown"
    KNOWN = "known"


class AccommodationType(StrEnum):
    TENT = "tent"
    FREE_SHELTER_OR_HUT = "free_shelter_or_hut"
    MOUNTAIN_HUT = "mountain_hut"
    OTHER_PAID_ACCOMMODATION = "other_paid_accommodation"


class WaterSourceType(StrEnum):
    TAP = "tap"
    SHOP = "shop"
    NATURAL = "natural"


class RestrictionType(StrEnum):
    CAMPING_RESTRICTED = "camping_restricted"
    ADVANCE_BOOKING_REQUIRED = "advance_booking_required"
    FEES_APPLY = "fees_apply"


class Direction(StrEnum):
    NORTHBOUND = "northbound"
    SOUTHBOUND = "southbound"
    EASTBOUND = "eastbound"
    WESTBOUND = "westbound"


class RouteScope(StrEnum):
    FULL_TRAIL = "full_trail"
    TRAIL_SECTION = "trail_section"
    CUSTOM_ROUTE = "custom_route"


class AchievementIcon(StrEnum):
    TROPHY = "trophy"
    DISTANCE = "distance"
    MOUNTAIN = "mountain"
    COMPASS = "compass"
    TENT = "tent"
    ARCTIC = "arctic"
