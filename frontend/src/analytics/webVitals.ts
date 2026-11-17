import { readConsent } from './consent'
import { analyticsUrl, sendAnalyticsEvent } from './googleAnalytics'

const reported = new Set<string>()

type Vital = {
  name: string
  id: string
  value: number
  rating: string
  navigationType: string
}

export function reportWebVital(metric: Vital) {
  const consent = readConsent()
  if (
    consent?.choice !== 'accepted' ||
    consent.savedAt > performance.timeOrigin ||
    metric.navigationType === 'soft-navigation' ||
    !['LCP', 'INP', 'CLS'].includes(metric.name) ||
    reported.has(metric.id)
  ) {
    return
  }
  const navigation = performance.getEntriesByType('navigation').at(0)
  // Document navigation entries retain their URL during client-side routing.
  const page = analyticsUrl(navigation?.name || window.location.href)
  reported.add(metric.id)
  sendAnalyticsEvent('web_vital', {
    metric_name: metric.name,
    metric_id: metric.id,
    metric_value: metric.value,
    metric_rating: metric.rating,
    metric_navigation_type: metric.navigationType,
    page_location: page,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    non_interaction: true,
  })
}
