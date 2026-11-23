import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'

import { HikePagination } from '@/app/[locale]/hikes/[slug]/components/HikePagination'
import { messages } from '@/i18n/messages'

const mockPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: { params: { slug: string } }
    children: ReactNode
  }) => (
    <a {...props} href={`/hikes/${href.params.slug}`}>
      {children}
    </a>
  ),
}))

test('links to the localized neighboring hike and omits an unavailable previous hike', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikePagination
        neighbors={{
          previous: null,
          next: { id: 'hike-id', title: 'A forest journey', slug: 'forest-journey' },
        }}
      />
    </NextIntlClientProvider>,
  )
  expect(screen.getByRole('link', { name: /Next hike.*A forest journey/ })).toHaveAttribute(
    'href',
    '/hikes/forest-journey',
  )
  expect(screen.queryByText('Previous hike')).not.toBeInTheDocument()
})

test('omits hike-to-hike navigation when no translated neighbors exist', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikePagination neighbors={{ previous: null, next: null }} />
    </NextIntlClientProvider>,
  )
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

test('uses the arrow keys for neighboring hikes and leaves media and form controls alone', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikePagination
        neighbors={{
          previous: { id: 'previous-id', title: 'Previous', slug: 'previous-slug' },
          next: { id: 'next-id', title: 'Next', slug: 'next-slug' },
        }}
      />
      <input aria-label="Search" />
      <dialog aria-label="Gallery">
        <button type="button">Next photo</button>
      </dialog>
    </NextIntlClientProvider>,
  )
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(mockPush.mock.calls).toEqual([
    [{ pathname: '/hikes/[slug]', params: { slug: 'previous-slug' } }],
    [{ pathname: '/hikes/[slug]', params: { slug: 'next-slug' } }],
  ])

  fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true })
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'ArrowRight' })
  const dialog = document.querySelector('dialog')
  if (!dialog) {
    throw new Error('Missing gallery dialog')
  }
  dialog.open = true
  fireEvent.keyDown(screen.getByRole('button', { name: 'Next photo' }), { key: 'ArrowRight' })
  expect(mockPush).toHaveBeenCalledTimes(2)
})
