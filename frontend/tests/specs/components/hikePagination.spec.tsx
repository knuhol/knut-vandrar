import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'

import { HikePagination } from '@/app/[locale]/hikes/[slug]/components/HikePagination'
import { messages } from '@/i18n/messages'

jest.mock('@/i18n/navigation', () => ({
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
