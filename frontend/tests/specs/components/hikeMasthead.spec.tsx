import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import type { Hike } from '@/api/hikes'
import { HikeMasthead } from '@/app/[locale]/hikes/[slug]/components/HikeMasthead/HikeMasthead'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/navigation', () => ({ Link: 'a' }))
jest.mock('@/config/public', () => ({ publicConfig: { apiBaseUrl: 'https://api.example.test' } }))
jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: {
    fullHikeCover: '(min-width: 2560px)',
    desktopHikeCover: '(min-width: 1500px)',
  },
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

test('provides responsive cover sources and reveals the image once it loads', async () => {
  const hike = {
    status: 'completed',
    translation: { title: 'Sörmlandsleden' },
    cover_sources: {
      full: 'http://backend/api/hikes/example/cover-image?v=large',
      wide: 'http://backend/api/hikes/example/cover-image?variant=wide&v=wide',
      desktop: 'http://backend/api/hikes/example/cover-image?variant=desktop&v=desktop',
      mobile: 'http://backend/api/hikes/example/cover-image?variant=mobile&v=medium',
      card: 'http://backend/api/hikes/example/cover-image?variant=card&v=small',
    },
  } as Hike

  render(<HikeMasthead hike={hike} />)

  const image = screen.getByRole('img', { name: 'Sörmlandsleden' })
  const sources = image.closest('picture')?.querySelectorAll('source')
  expect(sources?.[0]).toHaveAttribute('media', '(min-width: 2560px)')
  expect(sources?.[0]).toHaveAttribute('type', 'image/avif')
  expect(sources?.[0]).toHaveAttribute(
    'srcset',
    'https://api.example.test/api/hikes/example/cover-image?variant=wide&v=wide',
  )
  expect(sources?.[1]).toHaveAttribute(
    'srcset',
    'https://api.example.test/api/hikes/example/cover-image?v=large',
  )
  expect(sources?.[2]).toHaveAttribute('media', '(min-width: 1500px)')
  expect(sources?.[2]).toHaveAttribute(
    'srcset',
    'https://api.example.test/api/hikes/example/cover-image?variant=desktop&v=desktop',
  )
  expect(image).toHaveAttribute(
    'src',
    'https://api.example.test/api/hikes/example/cover-image?variant=mobile&v=medium',
  )
  expect(image).toHaveAttribute('loading', 'eager')
  expect(image).toHaveAttribute('fetchpriority', 'high')
  expect(image).toHaveClass('image-reveal')
  expect(image).not.toHaveAttribute('data-image-ready')

  fireEvent.load(image)
  await waitFor(() => {
    expect(image).toHaveAttribute('data-image-ready')
  })
})
