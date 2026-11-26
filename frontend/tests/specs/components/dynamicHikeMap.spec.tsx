import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import type { PlannedMap, TrackingProgress } from '@/api/tracking'
import { DynamicHikeMap } from '@/app/[locale]/hikes/[slug]/components/DynamicHikeMap/DynamicHikeMap'
import { messages } from '@/i18n/messages'

const mockReadProgress = jest.fn<
  Promise<{ ok: boolean; json: () => Promise<TrackingProgress> }>,
  unknown[]
>()
jest.mock('@/api/tracking', () => ({
  trackingClient: () => ({
    '/api/hikes/{hike_id}/tracking-progress': {
      get: (...args: unknown[]) => mockReadProgress(...args),
    },
  }),
}))

jest.mock('@/app/[locale]/hikes/[slug]/components/DynamicHikeMap/RouteMap', () => ({
  RouteMap: ({
    progress,
    stalePosition,
    overlay,
  }: {
    progress?: TrackingProgress
    stalePosition?: boolean
    overlay?: React.ReactNode
  }) => (
    <div data-testid="test-viewport" data-stale={stalePosition}>
      {progress?.position?.coordinates.join(',')}
      {overlay}
    </div>
  ),
}))

const route: PlannedMap = {
  revision: 'example',
  lines: [
    [
      [15, 59],
      [15.04, 59],
    ],
  ],
  bounds: [
    [15, 59],
    [15.04, 59],
  ],
  start: [15, 59],
  finish: [15.04, 59],
  labels: {},
  circular: false,
  total: 2000,
  style: {},
  overlay: {
    routeColorToken: 'orange',
    outlineColorToken: 'paper',
    startColorToken: 'forest',
    routeWidth: 4,
    outlineWidth: 7,
    markerRadius: 7,
    markerStrokeWidth: 3,
  },
  tokens: {},
}

function progress(value: number, lon: number): TrackingProgress {
  return {
    status: 'active',
    revision: route.revision,
    completed: value,
    remaining: route.total - value,
    percentage: value / 20,
    backtracked: 0,
    position: {
      coordinates: [lon, 59],
      line: 0,
      edge: 0,
      distance: value,
      offset: 0,
      recorded_at: '2026-09-17T10:30:00Z',
    },
  }
}

function renderLive() {
  render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages.en}>
      <DynamicHikeMap hikeId="example-hike" route={route} ongoing />
    </NextIntlClientProvider>,
  )
}

test('refreshes progress in place', async () => {
  jest.useFakeTimers()
  try {
    mockReadProgress
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(progress(500, 15.01)) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(progress(1000, 15.02)) })
    await act(() => {
      renderLive()
      return Promise.resolve()
    })
    const viewport = screen.getByTestId('test-viewport')
    expect(viewport).toHaveTextContent('15.01,59')
    const stats = screen.getByRole('button', { name: 'Hike statistics' })
    expect(stats).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Completion: 25%')).toBeVisible()
    fireEvent.click(stats)
    expect(stats).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Completion: 25%')).not.toBeVisible()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000)
    })
    expect(screen.getByTestId('test-viewport')).toBe(viewport)
    expect(viewport).toHaveTextContent('15.02,59')
    expect(stats).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(stats)
    expect(screen.getByText('Completion: 50%')).toBeVisible()
  } finally {
    jest.useRealTimers()
  }
})

test('keeps the last position during a failed refresh and recovers on the next poll', async () => {
  jest.useFakeTimers()
  try {
    mockReadProgress
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(progress(500, 15.01)) })
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(progress(1000, 15.02)) })
    await act(() => {
      renderLive()
      return Promise.resolve()
    })

    await act(() => jest.advanceTimersByTimeAsync(30_000))
    expect(screen.getByTestId('test-viewport')).toHaveTextContent('15.01,59')
    expect(screen.getByText('Completion: 25%')).toBeVisible()

    await act(() => jest.advanceTimersByTimeAsync(30_000))
    expect(screen.getByTestId('test-viewport')).toHaveTextContent('15.02,59')
    expect(screen.getByText('Completion: 50%')).toBeVisible()
  } finally {
    jest.useRealTimers()
  }
})

test('keeps a stale marker visible until a freshly recorded fix arrives', async () => {
  jest.useFakeTimers({ now: new Date('2026-09-17T11:00:00Z') })
  try {
    mockReadProgress
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...progress(500, 15.01),
            latest_recorded_at: '2026-09-17T10:30:00Z',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...progress(1000, 15.02),
            latest_recorded_at: '2026-09-17T11:00:25Z',
          }),
      })
    await act(() => {
      renderLive()
      return Promise.resolve()
    })
    const viewport = screen.getByTestId('test-viewport')
    expect(viewport).toHaveAttribute('data-stale', 'true')
    expect(viewport).toHaveTextContent('15.01,59')
    expect(viewport).toHaveTextContent('Last update: 30 minutes ago')
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000)
    })
    expect(viewport).toHaveAttribute('data-stale', 'false')
    expect(viewport).toHaveTextContent('15.02,59')
    expect(viewport).not.toHaveTextContent('Last update')
  } finally {
    jest.useRealTimers()
  }
})

test('shows elapsed days and hours and estimates time remaining after 72 hours', async () => {
  jest.useFakeTimers({ now: new Date('2026-09-20T10:29:30Z') })
  try {
    const halfway = { ...progress(1000, 15.02), first_recorded_at: '2026-09-17T10:30:00Z' }
    mockReadProgress.mockResolvedValue({ ok: true, json: () => Promise.resolve(halfway) })
    await act(() => {
      renderLive()
      return Promise.resolve()
    })
    expect(screen.getByText('Elapsed: 2 days 23 hours')).toBeInTheDocument()
    expect(screen.queryByText(/Average progress/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Estimated time left/)).not.toBeInTheDocument()

    const dayThree = {
      ...halfway,
      average_metres_per_day: 750,
    }
    mockReadProgress.mockResolvedValue({ ok: true, json: () => Promise.resolve(dayThree) })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000)
    })
    expect(screen.getByText('Elapsed: 3 days 0 hours')).toBeInTheDocument()
    expect(screen.getByText('Average progress: 1 km/day')).toBeInTheDocument()
    expect(screen.getByText('Estimated time left: 3 days')).toBeInTheDocument()

    mockReadProgress.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...dayThree, ...progress(1300, 15.026) }),
    })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000)
    })
    expect(screen.getByText('Estimated time left: 2 days')).toBeInTheDocument()

    mockReadProgress.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ ...dayThree, ...progress(1900, 15.038), walking_metres_per_hour: 5500 }),
    })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000)
    })
    expect(screen.getByText('Average progress: 1 km/day')).toBeInTheDocument()
    expect(screen.getByText('Estimated walking time left: 1 hour')).toBeInTheDocument()
  } finally {
    mockReadProgress.mockReset()
    jest.useRealTimers()
  }
})
