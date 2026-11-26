import { analyticsUrl, sendAnalyticsEvent } from './umami'
import type { Hike } from '@/api/hikes'
import type { VisibleHikeCard } from '@/hiking/presentation'
import type { Locale } from '@/i18n/routing'

type HikeInteraction = { hikeId: string; hikeTitle: Hike['english_title']; locale: Locale } & (
  | {
      name: 'hike_resource_click'
      resourceType: Exclude<VisibleHikeCard['type'], 'youtube_video'>
    }
  | { name: 'video_open' | 'gallery_open' }
)

export function trackHikeInteraction(event: HikeInteraction) {
  // Explicit fields prevent resource URLs, passwords and captions entering analytics.
  sendAnalyticsEvent(event.name, {
    hike_id: event.hikeId,
    ...(event.hikeTitle ? { hike_title: event.hikeTitle } : {}),
    locale: event.locale,
    page_location: analyticsUrl(window.location.href),
    ...(event.name === 'hike_resource_click' ? { resource_type: event.resourceType } : {}),
  })
}
