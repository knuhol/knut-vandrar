import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { initializeAnalytics, stopAnalytics } from '@/analytics/googleAnalytics'
import { saveConsent } from '@/analytics/consent'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/en/hikes/test?private=secret#password')
})
afterEach(() => {
  stopAnalytics()
})

test('custom interactions remain silent before consent and after rejection', () => {
  initializeAnalytics('G-TEST123')
  trackHikeInteraction({ name: 'gallery_open', hikeId: '123', locale: 'en' })
  expect(window.dataLayer).toBeUndefined()
  saveConsent('accepted')
  initializeAnalytics('G-TEST123')
  const tag = jest.spyOn(window, 'gtag')
  saveConsent('rejected')
  trackHikeInteraction({ name: 'video_open', hikeId: '123', locale: 'en' })
  expect(tag).not.toHaveBeenCalled()
})

test('sends only intentional context, with no resource URL, password, query or fragment', () => {
  saveConsent('accepted')
  initializeAnalytics('G-TEST123')
  const tag = jest.spyOn(window, 'gtag')
  trackHikeInteraction({
    name: 'hike_resource_click',
    hikeId: '123',
    locale: 'cs',
    resourceType: 'live_position',
  })
  expect(tag).toHaveBeenCalledWith('event', 'hike_resource_click', {
    hike_id: '123',
    locale: 'cs',
    resource_type: 'live_position',
    page_location: 'http://localhost/en/hikes/test',
    send_to: 'G-TEST123',
  })
  trackHikeInteraction({ name: 'gallery_open', hikeId: '123', locale: 'en' })
  trackHikeInteraction({ name: 'video_open', hikeId: '123', locale: 'en' })
  expect(tag).toHaveBeenCalledTimes(3)
})
