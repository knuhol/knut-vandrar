import { saveConsent } from '@/analytics/consent'
import {
  analyticsUrl,
  initializeAnalytics,
  sendAnalyticsEvent,
  stopAnalytics,
  trackPageView,
} from '@/analytics/googleAnalytics'

const id = 'G-TEST123'

beforeEach(() => {
  stopAnalytics()
  window.localStorage.clear()
  delete window.dataLayer
  delete window.gtag
  window.history.replaceState(null, '', '/')
})

test('removes sensitive queries and hashes while retaining only intentional campaign fields', () => {
  const url = 'https://example.com/en/hikes?email=private&utm_source=newsletter#password'
  expect(analyticsUrl(url)).toBe('https://example.com/en/hikes')
  expect(analyticsUrl(url, true)).toBe('https://example.com/en/hikes?utm_source=newsletter')
})

test('does not initialize or send events without consent', () => {
  initializeAnalytics(id)
  sendAnalyticsEvent('page_view', {})
  expect(window.gtag).toBeUndefined()
  saveConsent('rejected')
  initializeAnalytics(id)
  expect(window.gtag).toBeUndefined()
})

test('queues consent before config, deduplicates pageviews and stops events on withdrawal', () => {
  saveConsent('accepted')
  initializeAnalytics(id)
  const commands = window.dataLayer?.map((command) => [...(command as Iterable<unknown>)])
  expect(commands?.[0]).toEqual([
    'consent',
    'default',
    expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' }),
  ])
  expect(commands?.[2]).toEqual(['config', id, expect.objectContaining({ send_page_view: false })])
  const tag = jest.spyOn(window, 'gtag')
  window.history.replaceState(null, '', '/en/first')
  trackPageView()
  trackPageView()
  window.history.pushState(null, '', '/en/second')
  trackPageView()
  window.history.pushState(null, '', '/en/first')
  trackPageView()
  expect(tag).toHaveBeenCalledTimes(3)
  saveConsent('rejected')
  sendAnalyticsEvent('web_vital', { value: 12 })
  expect(tag).toHaveBeenCalledTimes(3)
  document.cookie = '_ga=test; Path=/'
  document.cookie = '_ga_TEST123=test; Path=/'
  document.cookie = 'unrelated=keep; Path=/'
  expect(stopAnalytics()).toBe(true)
  expect(Reflect.get(window, `ga-disable-${id}`)).toBe(true)
  expect(document.cookie).not.toContain('_ga')
  expect(document.cookie).toContain('unrelated=keep')
})
