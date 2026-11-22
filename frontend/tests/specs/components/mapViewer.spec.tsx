import type { KeyboardEventHandler, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { MapViewer } from '@/app/[locale]/hikes/[slug]/components/HikeMap/MapViewer/MapViewer'
import { messages } from '@/i18n/messages'

jest.mock('@/api/images', () => ({ imageUrl: (url: string) => url }))
jest.mock('@/components/MediaModal/MediaModal', () => ({
  MediaModal: ({
    children,
    onClose,
    onKeyDown,
  }: {
    children: ReactNode
    onClose: () => void
    onKeyDown: KeyboardEventHandler<HTMLDialogElement>
  }) => (
    <dialog open onKeyDown={onKeyDown}>
      <button onClick={onClose}>Close map</button>
      {children}
    </dialog>
  ),
}))

test('opens the largest map, supports zoom, reset and keyboard controls, and closes', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <MapViewer
        hikeTitle="Bergslagsleden"
        images={[
          {
            variant: 'mobile',
            width: 800,
            height: 800,
            url: '/map-small.webp',
            sha256: 'a'.repeat(64),
          },
          {
            variant: 'desktop',
            width: 2000,
            height: 1600,
            url: '/map-large.webp',
            sha256: 'b'.repeat(64),
          },
        ]}
      >
        <span>Map preview</span>
      </MapViewer>
    </NextIntlClientProvider>,
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Enlarge map' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/map-large.webp')
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  expect(screen.getByText('150%')).toBeInTheDocument()
  fireEvent.keyDown(dialog, { key: '+' })
  expect(screen.getByText('200%')).toBeInTheDocument()
  const viewport = within(dialog).getByRole('region')
  Object.defineProperty(viewport, 'clientWidth', { value: 400 })
  const pan = jest.fn()
  viewport.scrollBy = pan
  fireEvent.keyDown(dialog, { key: 'ArrowRight' })
  expect(pan).toHaveBeenCalledWith({ left: 100, behavior: 'instant' })
  fireEvent.click(screen.getByRole('button', { name: 'Fit map to screen' }))
  expect(screen.getByText('100%')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Fit map to screen' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Close map' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
