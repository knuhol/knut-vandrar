import type { HikeSummary } from '@/api/hikes'

export function hasCompleteHikeStats(
  hike: Pick<HikeSummary, 'duration_days' | 'distance_km' | 'ascent_m'>,
) {
  return hike.duration_days != null && hike.distance_km != null && hike.ascent_m != null
}
