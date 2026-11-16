import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { messages } from '@/i18n/messages'

import type { Hike } from '@/api/hikes'

function renderCards(cards: Hike['cards']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <InfoCards cards={cards} />
    </NextIntlClientProvider>,
  )
}

test('active tracking password is selectable above the cards, outside the link', () => {
  renderCards([
    {
      type: 'live_position',
      state: 'active',
      url: 'https://share.garmin.com/hike',
      password: 'my-custom-password',
    },
  ])

  const password = screen.getByText('my-custom-password')
  const link = screen.getByRole('link')
  expect(screen.getByText('Live tracking password')).toBeInTheDocument()
  expect(password).toHaveClass('select-all')
  expect(within(link).queryByText('my-custom-password')).not.toBeInTheDocument()
  expect(password.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(link).toHaveAttribute('href', 'https://share.garmin.com/hike')
})

test.each([
  { state: 'inactive' as const, url: 'https://share.garmin.com/hike', password: 'hidden' },
  { state: 'active' as const, url: null, password: 'hidden' },
  { state: 'active' as const, url: 'https://share.garmin.com/hike', password: null },
])('omits the password when tracking or the password is unavailable: %j', (card) => {
  renderCards([{ type: 'live_position', ...card }])

  expect(screen.queryByText('Live tracking password')).not.toBeInTheDocument()
  expect(screen.queryByText('hidden')).not.toBeInTheDocument()
})

test('copy button confirms copying without an extra message below the password', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  renderCards([
    {
      type: 'live_position',
      state: 'active',
      url: 'https://share.garmin.com/hike',
      password: 'custom-123',
    },
  ])

  fireEvent.click(screen.getByRole('button', { name: 'Copy password' }))

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByText('Copied!')).toHaveLength(1)
  })
  expect(writeText).toHaveBeenCalledWith('custom-123')
})

test('clipboard failure leaves the password visible with manual copy instructions', async () => {
  const writeText = jest.fn().mockRejectedValue(new Error('Unavailable'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  renderCards([
    {
      type: 'live_position',
      state: 'active',
      url: 'https://share.garmin.com/hike',
      password: 'custom-123',
    },
  ])

  fireEvent.click(screen.getByRole('button', { name: 'Copy password' }))

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('Select the password')
  })
  expect(screen.getByText('custom-123')).toHaveClass('select-all')
})
