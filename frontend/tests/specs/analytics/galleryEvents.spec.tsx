import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { HikeGallery } from '@/app/[locale]/hikes/[slug]/components/HikeGallery/HikeGallery'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { messages } from '@/i18n/messages'

jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: { tablet: 'tablet-media', desktop: 'desktop-media', wide: 'wide-media' },
}))
jest.mock('@/analytics/hikeEvents', () => ({ trackHikeInteraction: jest.fn() }))
jest.mock('@/components/MediaModal/MediaModal', () => ({
  MediaModal: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
    <div role="dialog">
      <button onClick={onClose}>Close gallery</button>
      {children}
    </div>
  ),
}))

function renderGallery() {
  return render(
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
}

test('records gallery openings, but not navigation between photos', () => {
  renderGallery()
  expect(trackHikeInteraction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open photo 1: Photo 1' }))
  expect(trackHikeInteraction).toHaveBeenCalledWith({
    name: 'gallery_open',
    hikeId: '123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
  })
  expect(screen.getByText('Photo 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
  expect(screen.getByText('Photo 2')).toBeInTheDocument()
  expect(trackHikeInteraction).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Close gallery' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open photo 2: Photo 2' }))
  expect(trackHikeInteraction).toHaveBeenCalledTimes(2)
})

test('moves the photo caption and arrows outside only when there is room', () => {
  const originalObserver = globalThis.ResizeObserver
  let notify: () => void = jest.fn()
  globalThis.ResizeObserver = class {
    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()

    constructor(callback: ResizeObserverCallback) {
      notify = () => {
        callback([], this)
      }
    }
  }

  try {
    renderGallery()
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 1: Photo 1' }))
    const caption = screen.getByText('Photo 1').parentElement
    const frame = caption?.parentElement
    const viewer = frame?.parentElement
    const previous = screen.getByRole('button', { name: 'Previous photo' }).parentElement
    const next = screen.getByRole('button', { name: 'Next photo' }).parentElement
    if (!caption || !frame || !viewer || !previous || !next) {
      throw new Error('Missing gallery controls')
    }
    jest.spyOn(caption, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 70))
    jest.spyOn(viewer, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600))
    jest.spyOn(previous, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 60, 44))
    jest.spyOn(next, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 60, 44))
    const frameBounds = jest
      .spyOn(frame, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(100, 100, 600, 400))

    act(notify)
    expect(caption).toHaveClass('top-full')
    expect(previous).toHaveClass('right-full')
    expect(next).toHaveClass('left-full')

    frameBounds.mockReturnValue(new DOMRect(0, 10, 800, 580))
    act(notify)
    expect(caption).toHaveClass('bottom-0')
    expect(previous).toHaveClass('left-0')
    expect(next).toHaveClass('right-0')
  } finally {
    globalThis.ResizeObserver = originalObserver
  }
})
