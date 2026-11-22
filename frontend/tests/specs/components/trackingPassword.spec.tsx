import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { TrackingPassword } from '@/app/[locale]/hikes/[slug]/components/TrackingPassword'
import { messages } from '@/i18n/messages'

test('selects and copies the complete password even when its display is truncated', async () => {
  const password = 'A-long-password-with-punctuation-and-several-words 2026!'
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <TrackingPassword password={password} />
    </NextIntlClientProvider>,
  )
  fireEvent.doubleClick(screen.getByText(password))
  expect(window.getSelection()?.toString()).toBe(password)
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })
  expect(writeText).toHaveBeenCalledWith(password)
  window.getSelection()?.removeAllRanges()
})
