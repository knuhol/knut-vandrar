import type { Hike } from '@/api/hikes'

export type AccommodationType = 'tent' | 'freeShelter' | 'mountainHut' | 'paidAccommodation'
export type HikeDetails = {
  direction: NonNullable<Hike['direction']> | null
  scope: Hike['route_scope']
  stages: { start: number; end: number } | null
  achievements: Hike['achievements']
  overnights: { type: AccommodationType; count: number }[]
}
export type TrailDetails = {
  hikingMonths: number[]
  waterSources: ('tap' | 'shop' | 'natural')[]
  overnightOptions: AccommodationType[]
  overnightRestrictions: ('campingRestrictions' | 'bookingRequired' | 'feesMayApply')[]
  seasonNote: string | null
  overnightNote: string | null
}
