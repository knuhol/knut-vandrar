import { visibleHikeCards } from '@/hiking/presentation'

import type { Hike } from '@/api/hikes'

const tracking = {
  type: 'live_position',
  state: 'active',
} as const
const route = { type: 'route', url: 'https://example.com/route' } as const

test.each<{ status: Hike['status']; visible: boolean }>([
  { status: 'planned', visible: true },
  { status: 'ongoing', visible: true },
  { status: 'completed', visible: false },
  { status: 'aborted', visible: false },
])('$status hikes show live tracking: $visible', ({ status, visible }) => {
  expect(visibleHikeCards({ status, cards: [route], live_tracking: tracking })).toEqual(
    visible ? [tracking, route] : [route],
  )
})
