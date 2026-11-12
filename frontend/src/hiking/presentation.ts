import type { AccommodationType, HikeDetails, TrailDetails } from './details'
import type { Hike } from '@/api/hikes'

export type Location = NonNullable<Hike['location']>
export type TrailTag =
  | 'mountains'
  | 'lowlands'
  | 'coastal'
  | 'loop'
  | 'aboveArcticCircle'
  | 'crossesArcticCircle'
  | 'waymarked'
  | 'partlyWaymarked'
  | 'unmarked'
export type TrailRatings = {
  facilities: number | null
  maintenance: number | null
  resupplies: number | null
  publicTransport: number | null
  difficulty: number | null
}
export type HikeEndpoints = {
  start: { latitude: number; longitude: number } | null
  end: { latitude: number; longitude: number } | null
}
const accommodation = {
  tent: 'tent',
  free_shelter_or_hut: 'freeShelter',
  mountain_hut: 'mountainHut',
  other_paid_accommodation: 'paidAccommodation',
} as const satisfies Record<
  NonNullable<Hike['overnights']>[number]['accommodation_type'],
  AccommodationType
>
const restrictions = {
  camping_restricted: 'campingRestrictions',
  advance_booking_required: 'bookingRequired',
  fees_apply: 'feesMayApply',
} as const

export function hikePresentation(hike: Hike): { endpoints: HikeEndpoints; details: HikeDetails } {
  return {
    endpoints: {
      start:
        hike.start_latitude != null && hike.start_longitude != null
          ? { latitude: hike.start_latitude, longitude: hike.start_longitude }
          : null,
      end:
        hike.end_latitude != null && hike.end_longitude != null
          ? { latitude: hike.end_latitude, longitude: hike.end_longitude }
          : null,
    },
    details: {
      direction: hike.direction ?? null,
      scope: hike.route_scope,
      stages:
        hike.start_stage != null && hike.end_stage != null
          ? { start: hike.start_stage, end: hike.end_stage }
          : null,
      achievements: hike.achievements,
      overnights: (hike.overnights ?? []).map((night) => ({
        type: accommodation[night.accommodation_type],
        count: night.night_count,
      })),
    },
  }
}

export function locationPresentation(location: Location): {
  tags: TrailTag[]
  ratings: TrailRatings | undefined
  details: TrailDetails
} {
  const tags: TrailTag[] = [...location.terrains]
  if (location.is_loop) {
    tags.push('loop')
  }
  if (location.arctic_circle_position === 'north') {
    tags.push('aboveArcticCircle')
  }
  if (location.arctic_circle_position === 'crosses') {
    tags.push('crossesArcticCircle')
  }
  if (location.waymarking) {
    tags.push(
      (
        {
          waymarked: 'waymarked',
          partly_waymarked: 'partlyWaymarked',
          unmarked: 'unmarked',
        } as const
      )[location.waymarking],
    )
  }
  const rating = location.ratings
  const half = (value: number | null | undefined) => (value == null ? null : value / 2)
  return {
    tags,
    ratings:
      rating &&
      [
        rating.facilities,
        rating.maintenance,
        rating.resupplies,
        rating.public_transport,
        rating.difficulty,
      ].some((score) => score != null)
        ? {
            facilities: half(rating.facilities),
            maintenance: half(rating.maintenance),
            resupplies: half(rating.resupplies),
            publicTransport: half(rating.public_transport),
            difficulty: half(rating.difficulty),
          }
        : undefined,
    details: {
      hikingMonths: location.hiking_months ?? [],
      waterSources: location.water_sources,
      overnightOptions: location.overnight_options.map((type) => accommodation[type]),
      overnightRestrictions: location.overnight_restrictions.map((type) => restrictions[type]),
      seasonNote: location.season_note ?? null,
      overnightNote: location.overnight_restrictions_note ?? null,
    },
  }
}
