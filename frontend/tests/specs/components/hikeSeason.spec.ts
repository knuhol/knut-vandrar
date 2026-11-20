import { hikeSeason } from '@/hiking/season'

import type { HikeSummary } from '@/api/hikes'

test.each([
  ['2026-01-10', 'winter'],
  ['2026-02-28', 'winter'],
  ['2026-03-01', 'spring'],
  ['2026-05-31', 'spring'],
  ['2026-06-01', 'summer'],
  ['2026-08-31', 'summer'],
  ['2026-09-01', 'autumn'],
  ['2026-11-30', 'autumn'],
  ['2026-12-01', 'winter'],
])('%s uses the %s calendar season', (date, season) => {
  expect(
    hikeSeason({
      status: 'completed',
      actual_start_at: `${date}T12:00:00Z`,
      planned_start_at: null,
    }),
  ).toMatchObject({ season, year: 2026 })
})

test.each<HikeSummary['status']>(['completed', 'aborted', 'ongoing', 'planned'])(
  '%s hikes use the appropriate start date',
  (status) => {
    expect(
      hikeSeason({
        status,
        planned_start_at: '2027-06-01T12:00:00Z',
        actual_start_at: '2026-10-01T12:00:00Z',
      }),
    ).toMatchObject(
      status === 'planned' ? { season: 'summer', year: 2027 } : { season: 'autumn', year: 2026 },
    )
  },
)

test('uses the site timezone at a year boundary', () => {
  expect(
    hikeSeason({
      status: 'completed',
      planned_start_at: null,
      actual_start_at: '2026-12-31T23:30:00Z',
    }),
  ).toMatchObject({ season: 'winter', year: 2027 })
})

test('omits the period when the start date is unknown', () => {
  expect(
    hikeSeason({ status: 'ongoing', planned_start_at: null, actual_start_at: null }),
  ).toBeUndefined()
})
