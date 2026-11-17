import { analyticsUrl, sendAnalyticsEvent } from './googleAnalytics'
import type { Hike } from '@/api/hikes'
import type { Locale } from '@/i18n/routing'

type HikeInteraction = { hikeId: string; locale: Locale } & (
  | {
      name: 'hike_resource_click'
      resourceType: Exclude<Hike['cards'][number]['type'], 'youtube_video'>
    }
  | { name: 'video_open' | 'gallery_open' }
)

export function trackHikeInteraction(event: HikeInteraction) {
  // Explicit fields prevent resource URLs, passwords and captions entering analytics.
  sendAnalyticsEvent(event.name, {
    hike_id: event.hikeId,
    locale: event.locale,
    page_location: analyticsUrl(window.location.href),
    ...(event.name === 'hike_resource_click' ? { resource_type: event.resourceType } : {}),
  })
}
