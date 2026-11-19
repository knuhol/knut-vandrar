import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { HikeGallery } from '@/app/[locale]/hikes/[slug]/components/HikeGallery/HikeGallery'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { messages } from '@/i18n/messages'

jest.mock('@/analytics/hikeEvents', () => ({ trackHikeInteraction: jest.fn() }))
jest.mock('@/components/MediaModal/MediaModal', () => ({
  MediaModal: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
    <div role="dialog">
      <button onClick={onClose}>Close gallery</button>
      {children}
    </div>
  ),
}))

test('records gallery openings, but not navigation between photos', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikeGallery
        hikeId="123"
        hikeTitle="Kungsleden"
        locale="en"
        initialPage={{
          items: [1, 2].map((id) => ({
            id: String(id),
            hike_id: '123',
            sort_order: id,
            width: 100,
            height: 100,
            thumbnail_url: `/thumb-${String(id)}.jpg`,
            image_url: `/photo-${String(id)}.jpg`,
            alt: `Photo ${String(id)}`,
            caption: null,
            translation: {},
          })),
          total: 2,
          offset: 0,
          limit: 24,
        }}
      />
    </NextIntlClientProvider>,
  )
  expect(trackHikeInteraction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open photo 1: Photo 1' }))
  expect(trackHikeInteraction).toHaveBeenCalledWith({
    name: 'gallery_open',
    hikeId: '123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
  })
  fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
  expect(trackHikeInteraction).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Close gallery' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open photo 2: Photo 2' }))
  expect(trackHikeInteraction).toHaveBeenCalledTimes(2)
})
