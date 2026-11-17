import { reportWebVital } from '@/analytics/webVitals'
import { consentKey } from '@/analytics/consent'
import { sendAnalyticsEvent } from '@/analytics/googleAnalytics'

jest.mock('@/analytics/googleAnalytics', () => ({
  analyticsUrl: (url: string) => url.split('?')[0],
  sendAnalyticsEvent: jest.fn(),
}))

const metric = {
  id: 'lcp-1',
  name: 'LCP',
  value: 1234.5,
  rating: 'good',
  navigationType: 'navigate',
}

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    value: () => [{ name: 'https://example.com/en/entry?private=secret' }],
  })
})

function consentAt(savedAt: number) {
  window.localStorage.setItem(
    consentKey,
    JSON.stringify({ version: 1, choice: 'accepted', savedAt }),
  )
}

test('does not send measurements without consent or after mid-document acceptance', () => {
  reportWebVital(metric)
  consentAt(Date.now())
  reportWebVital(metric)
  expect(sendAnalyticsEvent).not.toHaveBeenCalled()
})

test('reports the entry URL and raw metric once, and ignores soft navigations', () => {
  consentAt(performance.timeOrigin - 1)
  reportWebVital(metric)
  reportWebVital(metric)
  reportWebVital({ ...metric, id: 'soft', navigationType: 'soft-navigation' })
  expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1)
  expect(sendAnalyticsEvent).toHaveBeenCalledWith(
    'web_vital',
    expect.objectContaining({
      metric_name: 'LCP',
      metric_value: 1234.5,
      value: 1235,
      page_location: 'https://example.com/en/entry',
    }),
  )
  reportWebVital({ ...metric, id: 'cls-1', name: 'CLS', value: 0.075 })
  expect(sendAnalyticsEvent).toHaveBeenLastCalledWith(
    'web_vital',
    expect.objectContaining({ metric_value: 0.075, value: 75 }),
  )
})
