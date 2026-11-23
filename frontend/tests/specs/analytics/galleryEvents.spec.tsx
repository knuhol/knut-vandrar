import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { HikeGallery } from '@/app/[locale]/hikes/[slug]/components/HikeGallery/HikeGallery'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { imageUrl } from '@/api/images'
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

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
})

function renderGallery(ids = [1, 2]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikeGallery
        hikeId="123"
        hikeTitle="Kungsleden"
        locale="en"
        initialPage={{
          items: ids.map((id) => ({
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
          total: ids.length,
          offset: 0,
          limit: 24,
        }}
      />
    </NextIntlClientProvider>,
  )
}

test('prefetches nearby fullscreen images only after opening the viewer', () => {
  const requests: HTMLImageElement[] = []
  const constructor = jest.spyOn(window, 'Image').mockImplementation(() => {
    const image = document.createElement('img')
    requests.push(image)
    return image
  })

  try {
    renderGallery([1, 2, 3, 4])
    expect(requests).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Open photo 1: Photo 1' }))
    expect(requests.map((image) => image.getAttribute('src'))).toEqual(
      [2, 3].map((id) => imageUrl(`/photo-${String(id)}.jpg`)),
    )
    expect(requests.every((image) => image.fetchPriority === 'low')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(requests.map((image) => image.getAttribute('src'))).toEqual(
      [2, 3, 1, 4].map((id) => imageUrl(`/photo-${String(id)}.jpg`)),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(requests).toHaveLength(4)
  } finally {
    constructor.mockRestore()
  }
})

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
    const previous = screen.getByRole('button', { name: 'Previous photo' }).parentElement
    const next = screen.getByRole('button', { name: 'Next photo' }).parentElement
    const frame = previous?.parentElement
    const viewer = frame?.parentElement
    if (!caption || !previous || !next || !frame || !viewer) {
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

test('keeps the old photo visible until the incoming photo can slide in', async () => {
  renderGallery()
  fireEvent.click(screen.getByRole('button', { name: 'Open photo 1: Photo 1' }))
  const viewer = within(screen.getByRole('dialog'))

  fireEvent.click(viewer.getByRole('button', { name: 'Next photo' }))
  const incoming = viewer.getByAltText<HTMLImageElement>('Photo 2')
  const frame = incoming.parentElement
  const slide = frame?.parentElement
  if (!frame || !slide) {
    throw new Error('Missing photo slide')
  }
  expect(slide).toHaveClass('invisible')
  expect(slide).toContainElement(viewer.getByText('Photo 2'))
  expect(viewer.getByAltText('Photo 1').parentElement).toContainElement(viewer.getByText('Photo 1'))

  frame.style.position = 'relative'
  incoming.width = 400
  incoming.height = 400
  fireEvent.load(incoming)
  await waitFor(() => {
    expect(slide).not.toHaveClass('invisible')
  })
  fireEvent.animationEnd(slide)
  expect(viewer.queryByAltText('Photo 1')).not.toBeInTheDocument()
  expect(viewer.queryByText('Photo 1')).not.toBeInTheDocument()

  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  fireEvent.click(viewer.getByRole('button', { name: 'Previous photo' }))
  expect(viewer.getByAltText('Photo 1')).toBeInTheDocument()
  expect(viewer.queryByAltText('Photo 2')).not.toBeInTheDocument()
})
