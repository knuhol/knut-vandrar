import { visibleHikeCards } from '@/hiking/presentation'

import type { Hike } from '@/api/hikes'

const tracking = {
  type: 'live_position',
  state: 'active',
  url: 'https://share.garmin.com/hike',
  password: 'public-password',
} as const
const route = { type: 'route', url: 'https://example.com/route' } as const

test.each<Hike['status']>(['planned', 'ongoing'])(
  '%s hikes retain live tracking and the original card order',
  (status) => {
    expect(visibleHikeCards({ status, cards: [route, tracking] })).toEqual([route, tracking])
  },
)

test.each<Hike['status']>(['completed', 'aborted'])(
  '%s hikes hide live tracking even when active, preserving other cards',
  (status) => {
    expect(visibleHikeCards({ status, cards: [tracking, route] })).toEqual([route])
    expect(visibleHikeCards({ status, cards: [tracking] })).toEqual([])
  },
)
