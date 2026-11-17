import { readConsent } from './consent'

type Parameters = Record<string, string | number | boolean>
type GoogleTag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GoogleTag
  }
}

let activeId: string | null = null
let lastPage: string | null = null
let previousPage: string | null = null
const campaignParameters = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

export function analyticsUrl(input: string, keepCampaign = false) {
  const url = new URL(input, window.location.origin)
  url.hash = ''
  const query = new URLSearchParams()
  if (keepCampaign) {
    for (const key of campaignParameters) {
      const value = url.searchParams.get(key)
      if (value) {
        query.set(key, value)
      }
    }
  }
  url.search = query.toString()
  return url.href
}

export function initializeAnalytics(id: string) {
  if (activeId || readConsent()?.choice !== 'accepted') {
    return
  }
  window.dataLayer = window.dataLayer || []
  window.gtag = function () {
    // The Google tag consumes Arguments objects, not ordinary arrays.
    // Google requires the native Arguments object for its command queue.
    // eslint-disable-next-line prefer-rest-params -- vendor protocol; arrays are not gtag commands.
    window.dataLayer?.push(arguments)
  }
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  window.gtag('js', new Date())
  window.gtag('config', id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: analyticsUrl(window.location.href, true),
    page_referrer: document.referrer ? analyticsUrl(document.referrer) : '',
    cookie_flags: 'SameSite=Lax;Secure',
  })
  activeId = id
}

export function sendAnalyticsEvent(name: string, parameters: Parameters) {
  if (!activeId || readConsent()?.choice !== 'accepted') {
    return
  }
  window.gtag?.('event', name, { ...parameters, send_to: activeId })
}

export function trackPageView() {
  const location = analyticsUrl(window.location.href, true)
  if (!activeId || readConsent()?.choice !== 'accepted' || lastPage === location) {
    return
  }
  sendAnalyticsEvent('page_view', {
    page_location: location,
    page_referrer: previousPage || (document.referrer ? analyticsUrl(document.referrer) : ''),
    page_title: document.title,
  })
  lastPage = location
  previousPage = analyticsUrl(location)
}

export function stopAnalytics() {
  if (!activeId) {
    return false
  }
  Reflect.set(window, `ga-disable-${activeId}`, true)
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  activeId = null
  lastPage = null
  previousPage = null
  window.dataLayer = []

  // Remove host-only cookies and cookies placed on parent domains by GA.
  const hostParts = window.location.hostname.split('.')
  const domains = ['', ...hostParts.map((_, index) => hostParts.slice(index).join('.'))]
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim()
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ''}`
      }
    }
  }
  return true
}
