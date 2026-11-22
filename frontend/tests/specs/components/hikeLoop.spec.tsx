import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { HikeJourney, hasHikeJourney } from '@/app/[locale]/hikes/[slug]/components/HikeJourney'
import type { HikeDetails } from '@/hiking/details'
import { messages } from '@/i18n/messages'

const loop: HikeDetails = {
  direction: null,
  scope: null,
  isLoop: true,
  namedRoute: null,
  stages: null,
  achievements: [],
  overnights: [],
}

test('shows a loop in hike route details even without a location or other journey facts', () => {
  expect(hasHikeJourney(loop)).toBe(true)
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikeJourney details={loop} status="completed" />
    </NextIntlClientProvider>,
  )
  expect(screen.getByText('Loop')).toBeInTheDocument()
})

test.each([false, null])('does not infer a loop when hike loop status is %s', (isLoop) => {
  expect(hasHikeJourney({ ...loop, isLoop })).toBe(false)
})

test('keeps the combined route section available when only hike facts exist', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <HikeJourney
        details={{ ...loop, isLoop: null }}
        status="completed"
        facts={<p>280 km over 14 days</p>}
        more={<a href="#trail">More about the trail</a>}
      />
    </NextIntlClientProvider>,
  )
  expect(screen.getByText('280 km over 14 days')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'More about the trail' })).toHaveAttribute(
    'href',
    '#trail',
  )
  expect(document.getElementById('journey')).toBeInTheDocument()
})
