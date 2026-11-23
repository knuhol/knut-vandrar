import { render, screen, within } from '@testing-library/react'

import type { Hike } from '@/api/hikes'
import { HikeMasthead } from '@/app/[locale]/hikes/[slug]/components/HikeMasthead/HikeMasthead'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/navigation', () => ({ Link: 'a' }))
jest.mock('@/config/public', () => ({ publicConfig: { apiBaseUrl: 'https://api.example.test' } }))
jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: { belowTablet: '(max-width: 639px)' },
}))

test.each(['Sörmland · Southeastern Sweden', null])(
  'renders the optional location above the title and keeps the season off the cover (%s)',
  (geographicLabel) => {
    const hike = {
      status: 'completed',
      actual_start_at: '2026-06-01T12:00:00Z',
      translation: { title: 'Sörmlandsleden', geographic_label: geographicLabel },
    } as Hike
    render(<HikeMasthead hike={hike} />)

    const cover = within(screen.getByRole('banner'))
    const title = cover.getByRole('heading', { level: 1, name: 'Sörmlandsleden' })
    expect(cover.getByText('completed')).toBeVisible()
    expect(cover.queryByText('hikeSeason')).not.toBeInTheDocument()

    if (geographicLabel) {
      expect(title.previousElementSibling).toHaveTextContent(geographicLabel)
    } else {
      expect(title.previousElementSibling).toHaveTextContent('completed')
    }
  },
)

test('uses the versioned card image as the cover on phones', () => {
  const hike = {
    status: 'completed',
    translation: { title: 'Sörmlandsleden' },
    cover_sources: {
      full: 'http://backend/api/hikes/example/cover-image?v=large',
      mobile: 'http://backend/api/hikes/example/cover-image?variant=mobile&v=medium',
      card: 'http://backend/api/hikes/example/cover-image?variant=card&v=small',
    },
  } as Hike

  render(<HikeMasthead hike={hike} />)

  const image = screen.getByRole('img', { name: 'Sörmlandsleden' })
  const sources = image.closest('picture')?.querySelectorAll('source')
  expect(sources?.[0]).toHaveAttribute('media', '(max-width: 639px)')
  expect(sources?.[0]).toHaveAttribute(
    'srcset',
    'https://api.example.test/api/hikes/example/cover-image?variant=card&v=small',
  )
  expect(image).toHaveAttribute(
    'src',
    'https://api.example.test/api/hikes/example/cover-image?variant=mobile&v=medium',
  )
})
