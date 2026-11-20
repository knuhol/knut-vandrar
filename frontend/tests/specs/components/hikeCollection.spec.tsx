import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { HikeCollection } from '@/app/[locale]/components/HikeCollection'
import { messages } from '@/i18n/messages'
import type { HikeSummary } from '@/api/hikes'

jest.mock('@/app/[locale]/components/HikeCard', () => ({
  HikeCard: ({ hike }: { hike: HikeSummary }) => <article>{hike.translation.title}</article>,
}))
jest.mock('@/components/Pill', () => ({
  Pill: ({ children }: { children: ReactNode }) => <button disabled>{children}</button>,
  PillLink: ({
    children,
    href,
  }: {
    children: ReactNode
    href: { query: Record<string, number>; hash: string }
  }) => (
    <a
      href={`/?${new URLSearchParams(Object.entries(href.query).map(([key, value]) => [key, String(value)]))}#${href.hash}`}
    >
      {children}
    </a>
  ),
}))

function hike(index: number): HikeSummary {
  return {
    id: String(index),
    location: null,
    status: 'completed',
    planned_start_at: null,
    planned_end_at: null,
    actual_start_at: '2026-06-01T12:00:00Z',
    actual_end_at: '2026-06-07T12:00:00Z',
    distance_km: 100,
    ascent_m: null,
    duration_days: 6,
    start_point: null,
    end_point: null,
    cover_image_url: null,
    translation: {
      locale: 'en',
      title: `Hike ${String(index)}`,
      tagline: null,
      summary_markdown: 'Summary',
      description_markdown: null,
      slug: `hike-${String(index)}`,
      review_status: 'manual',
      is_outdated: false,
    },
  }
}

test('shows six hikes in each category with independent totals and links that preserve the other page', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikeCollection
        pages={{
          long_distance: {
            items: Array.from({ length: 6 }, (_, index) => hike(index)),
            total: 14,
            limit: 6,
            offset: 6,
          },
          multi_day: {
            items: Array.from({ length: 6 }, (_, index) => hike(index + 6)),
            total: 8,
            limit: 6,
            offset: 0,
          },
        }}
      />
    </NextIntlClientProvider>,
  )
  const long = within(screen.getByRole('region', { name: 'Long-distance hikes' }))
  const multi = within(screen.getByRole('region', { name: 'Multi-day hikes' }))
  expect(long.getAllByRole('article')).toHaveLength(6)
  expect(multi.getAllByRole('article')).toHaveLength(6)
  expect(long.getByText('14 hikes')).toBeInTheDocument()
  expect(multi.getByText('8 hikes')).toBeInTheDocument()
  expect(screen.getAllByText('KNUT HOLM · MY HIKES')).toHaveLength(2)
  const longNext = new URL(
    long.getByRole('link', { name: 'Next' }).getAttribute('href') || '',
    'https://example.com',
  )
  expect(longNext.searchParams.get('offset')).toBe('12')
  expect(longNext.searchParams.has('multiDayOffset')).toBe(false)
  expect(longNext.hash).toBe('#long-distance-hikes')
  const multiNext = new URL(
    multi.getByRole('link', { name: 'Next' }).getAttribute('href') || '',
    'https://example.com',
  )
  expect(multiNext.searchParams.get('offset')).toBe('6')
  expect(multiNext.searchParams.get('multiDayOffset')).toBe('6')
  expect(multiNext.hash).toBe('#multi-day-hikes')
  expect(multi.getByRole('button', { name: 'Previous' })).toBeDisabled()
})
