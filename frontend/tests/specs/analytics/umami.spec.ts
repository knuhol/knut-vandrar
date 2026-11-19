import {
  analyticsUrl,
  initializeAnalytics,
  sendAnalyticsEvent,
  stopAnalytics,
  trackPageView,
} from '@/analytics/umami'

const id = 'b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d'

beforeEach(() => {
  stopAnalytics()
  window.localStorage.clear()
  delete window.umami
  delete window.umamiBeforeSend
  window.history.replaceState(null, '', '/')
})

test('removes sensitive queries and hashes while retaining only intentional campaign fields', () => {
  const url = 'https://example.com/en/hikes?email=private&utm_source=newsletter#password'
  expect(analyticsUrl(url)).toBe('https://example.com/en/hikes')
  expect(analyticsUrl(url, true)).toBe('https://example.com/en/hikes?utm_source=newsletter')
})

test('sends events without a consent choice once initialized', () => {
  window.umami = { track: jest.fn() }
  sendAnalyticsEvent('gallery_open', {})
  expect(window.umami.track).not.toHaveBeenCalled()
  initializeAnalytics(id)
  sendAnalyticsEvent('gallery_open', {})
  expect(window.umami.track).toHaveBeenCalledWith(expect.objectContaining({ name: 'gallery_open' }))
})

test('waits for the script, deduplicates pageviews, tracks navigation and stops when disabled', () => {
  initializeAnalytics(id)
  trackPageView()
  window.umami = { track: jest.fn() }
  window.history.replaceState(null, '', '/en/first?private=secret#password')
  trackPageView()
  trackPageView()
  window.history.pushState(null, '', '/en/second')
  trackPageView()
  window.history.pushState(null, '', '/en/first')
  trackPageView()
  expect(window.umami.track).toHaveBeenCalledTimes(3)
  expect(window.umami.track).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ website: id, url: 'http://localhost/en/first', referrer: '' }),
  )
  expect(window.umami.track).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ referrer: 'http://localhost/en/first' }),
  )
  stopAnalytics()
  sendAnalyticsEvent('gallery_open', { hike_id: '123' })
  trackPageView()
  expect(window.umami.track).toHaveBeenCalledTimes(3)
  expect(window.umamiBeforeSend?.('event', { url: '/en' })).toBe(false)
  stopAnalytics()
})

test('sanitizes vendor requests and explicit event page URLs', () => {
  initializeAnalytics(id)
  window.umami = { track: jest.fn() }
  expect(
    window.umamiBeforeSend?.('event', {
      url: '/en?secret=hidden&utm_source=test#hidden',
      referrer: 'https://example.com/?secret=hidden',
    }),
  ).toEqual({ url: 'http://localhost/en?utm_source=test', referrer: 'https://example.com/' })
  sendAnalyticsEvent('gallery_open', { page_location: 'http://localhost/en/entry', hike_id: '123' })
  expect(window.umami.track).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'gallery_open',
      url: 'http://localhost/en/entry',
      data: { page_location: 'http://localhost/en/entry', hike_id: '123' },
    }),
  )
  stopAnalytics()
  expect(window.umamiBeforeSend?.('event', {})).toBe(false)
})

test('preserves native performance metrics and sanitizes their URL without converting them to events', () => {
  initializeAnalytics(id)
  const metrics = { lcp: 1234.5, cls: 0.075, inp: 120, fcp: 300, ttfb: 50 }
  const payload = window.umamiBeforeSend?.('performance', {
    website: id,
    url: '/en/entry?private=secret#hidden',
    data: metrics,
  })
  expect(payload).toEqual({
    website: id,
    url: 'http://localhost/en/entry',
    referrer: '',
    data: metrics,
  })
  stopAnalytics()
  expect(window.umamiBeforeSend?.('performance', { data: metrics })).toBe(false)
})
