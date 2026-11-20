import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { StarRating } from '@/components/StarRating'
import { messages } from '@/i18n/messages'

function renderRating(value: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <StarRating value={value} />
    </NextIntlClientProvider>,
  )
}

test('shows N/A without stars or a numeric score', () => {
  const { container } = renderRating(-1)
  expect(screen.getByText('Not applicable')).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeNull()
  expect(screen.queryByText('0 / 5')).not.toBeInTheDocument()
})

test('keeps zero as an applicable rating', () => {
  const { container } = renderRating(0)
  expect(screen.getByText('0 / 5')).toBeInTheDocument()
  expect(container.querySelectorAll('svg')).toHaveLength(5)
  expect(screen.queryByText('Not applicable')).not.toBeInTheDocument()
})
