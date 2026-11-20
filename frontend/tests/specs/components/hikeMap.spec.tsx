import { render, screen } from '@testing-library/react'

import { HikeMap } from '@/app/[locale]/hikes/[slug]/components/HikeMap/HikeMap'
import type { HikeMapImage } from '@/api/hikes'

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(() =>
    Promise.resolve((key: string, values?: { title: string }) =>
      key === 'title' ? 'Hike map' : `Map showing the complete route for ${values?.title || ''}`,
    ),
  ),
}))
jest.mock('@/api/images', () => ({ imageUrl: (url: string) => url }))
jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: { tablet: 'tablet-media', desktop: 'desktop-media', wide: 'wide-media' },
}))

const images: HikeMapImage[] = ['mobile', 'tablet', 'desktop', 'wide'].map((variant) => ({
  variant,
  width: 1280,
  height: 1280,
  url: `https://example.com/maps/${variant}`,
  sha256: 'a'.repeat(64),
}))

test('shows a lazy complete-route image with responsive sources and a map landmark', async () => {
  const { container } = render(await HikeMap({ images, hikeTitle: 'Bergslagsleden' }))
  expect(screen.getByRole('heading', { name: 'Hike map' })).toBeInTheDocument()
  const image = screen.getByRole('img', {
    name: 'Map showing the complete route for Bergslagsleden',
  })
  expect(image).toHaveAttribute('src', images[0].url)
  expect(image).toHaveAttribute('loading', 'lazy')
  expect(image).toHaveClass('h-auto', 'w-full')
  expect(container.querySelector('#map')).toBeInTheDocument()
  const sources = [...container.querySelectorAll('picture source')]
  expect(sources.map((source) => source.getAttribute('media'))).toEqual([
    'wide-media',
    'desktop-media',
    'tablet-media',
  ])
  expect(sources.map((source) => source.getAttribute('srcset'))).toEqual([
    images[3].url,
    images[2].url,
    images[1].url,
  ])
})

test('omits the map entirely when no generated images exist', async () => {
  expect(await HikeMap({ images: [], hikeTitle: 'No map yet' })).toBeNull()
})

test('supports a partial set of stored formats', async () => {
  const { container } = render(await HikeMap({ images: [images[2]], hikeTitle: 'Partial' }))
  expect(screen.getByRole('img')).toHaveAttribute('src', images[2].url)
  expect(container.querySelectorAll('source')).toHaveLength(1)
})
