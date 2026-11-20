import type { HikeSummary } from '@/api/hikes'
import { siteIdentity } from '@/config/site'

const seasons = ['winter', 'spring', 'summer', 'autumn'] as const

// Calendar seasons: Dec–Feb, Mar–May, Jun–Aug and Sep–Nov.
export function hikeSeason(
  hike: Pick<HikeSummary, 'status' | 'planned_start_at' | 'actual_start_at'>,
) {
  const start = hike.status === 'planned' ? hike.planned_start_at : hike.actual_start_at
  if (!start) {
    return undefined
  }

  const parts = new Intl.DateTimeFormat('en', {
    month: 'numeric',
    year: 'numeric',
    timeZone: siteIdentity.timeZone,
  }).formatToParts(new Date(start))
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const year = Number(parts.find((part) => part.type === 'year')?.value)

  return { start, season: seasons[Math.floor((month % 12) / 3)], year }
}
