type Parameters = Record<string, string | number | boolean>
type Payload = Record<string, unknown>

declare global {
  interface Window {
    umami?: { track: (payload: Payload) => unknown }
    umamiBeforeSend?: (type: string, payload: Payload) => Payload | false
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
  if (activeId) {
    return
  }
  activeId = id
  // Guard every outgoing request, including requests made by the vendor tracker.
  window.umamiBeforeSend = (_type, payload) => {
    if (!activeId) {
      return false
    }
    return {
      ...payload,
      url: analyticsUrl(typeof payload.url === 'string' ? payload.url : window.location.href, true),
      referrer:
        typeof payload.referrer === 'string' && payload.referrer
          ? analyticsUrl(payload.referrer)
          : '',
    }
  }
}

function pagePayload(): Payload {
  return {
    website: activeId,
    hostname: window.location.hostname,
    language: navigator.language,
    screen: `${String(window.screen.width)}x${String(window.screen.height)}`,
    title: document.title,
    url: analyticsUrl(window.location.href, true),
    referrer: previousPage || (document.referrer ? analyticsUrl(document.referrer) : ''),
  }
}

export function sendAnalyticsEvent(name: string, parameters: Parameters) {
  if (!activeId) {
    return
  }
  const page = parameters.page_location
  window.umami?.track({
    ...pagePayload(),
    ...(typeof page === 'string' ? { url: analyticsUrl(page) } : {}),
    name,
    data: parameters,
  })
}

export function trackPageView() {
  const location = analyticsUrl(window.location.href, true)
  if (!activeId || !window.umami || lastPage === location) {
    return
  }
  window.umami.track(pagePayload())
  lastPage = location
  previousPage = analyticsUrl(location)
}

export function stopAnalytics() {
  activeId = null
  lastPage = null
  previousPage = null
}
