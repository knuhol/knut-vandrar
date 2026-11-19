import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { initializeAnalytics, stopAnalytics } from '@/analytics/umami'

beforeEach(() => {
  window.history.replaceState(null, '', '/en/hikes/test?private=secret#password')
})
afterEach(() => {
  stopAnalytics()
})

test('custom interactions remain silent before the tracker loads and after it is disabled', () => {
  initializeAnalytics('b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d')
  trackHikeInteraction({
    name: 'gallery_open',
    hikeId: '123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
  })
  expect(window.umami).toBeUndefined()
  window.umami = { track: jest.fn() }
  const tag = jest.spyOn(window.umami, 'track')
  stopAnalytics()
  trackHikeInteraction({ name: 'video_open', hikeId: '123', hikeTitle: 'Kungsleden', locale: 'en' })
  expect(tag).not.toHaveBeenCalled()
})

test('sends only intentional context, with no resource URL, password, query or fragment', () => {
  initializeAnalytics('b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d')
  window.umami = { track: jest.fn() }
  const tag = jest.spyOn(window.umami, 'track')
  trackHikeInteraction({
    name: 'hike_resource_click',
    hikeId: '123',
    hikeTitle: 'Kungsleden',
    locale: 'cs',
    resourceType: 'live_position',
  })
  expect(tag).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'hike_resource_click',
      data: {
        hike_id: '123',
        hike_title: 'Kungsleden',
        locale: 'cs',
        resource_type: 'live_position',
        page_location: 'http://localhost/en/hikes/test',
      },
    }),
  )
  trackHikeInteraction({
    name: 'gallery_open',
    hikeId: '123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
  })
  trackHikeInteraction({ name: 'video_open', hikeId: '123', hikeTitle: 'Kungsleden', locale: 'en' })
  expect(tag).toHaveBeenCalledTimes(3)
})

test.each(['sv', 'en', 'cs'] as const)(
  'keeps the English title with the %s page locale',
  (locale) => {
    initializeAnalytics('b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d')
    window.umami = { track: jest.fn() }
    trackHikeInteraction({
      name: 'gallery_open',
      hikeId: '123',
      hikeTitle: 'Hike through the Highlands',
      locale,
    })
    expect(window.umami.track).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          hike_id: '123',
          hike_title: 'Hike through the Highlands',
          locale,
          page_location: 'http://localhost/en/hikes/test',
        },
      }),
    )
  },
)

test('omits the title when the English source is missing', () => {
  initializeAnalytics('b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d')
  window.umami = { track: jest.fn() }
  trackHikeInteraction({ name: 'gallery_open', hikeId: '123', hikeTitle: null, locale: 'cs' })
  expect(window.umami.track).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { hike_id: '123', locale: 'cs', page_location: 'http://localhost/en/hikes/test' },
    }),
  )
})
