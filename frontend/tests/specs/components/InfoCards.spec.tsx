import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { messages } from '@/i18n/messages'

import type { VisibleHikeCard } from '@/hiking/presentation'

jest.mock('@/analytics/hikeEvents', () => ({ trackHikeInteraction: jest.fn() }))
jest.mock('@/app/[locale]/hikes/[slug]/components/VideoModal/VideoModal', () => ({
  VideoModal: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>Close video</button>
  ),
}))

function renderCards(cards: VisibleHikeCard[], mapShareUrl?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <InfoCards
        mapShareUrl={mapShareUrl}
        cards={cards}
        hikeId="hike-123"
        hikeTitle="Kungsleden"
        locale="en"
      />
    </NextIntlClientProvider>,
  )
}

test('resource activation sends stable context and preserves native link behavior', () => {
  renderCards([{ type: 'live_position', state: 'active' }], 'https://share.garmin.com/knuhol')
  const link = screen.getByRole('link')
  fireEvent.click(link)
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('href', 'https://share.garmin.com/knuhol')
  expect(trackHikeInteraction).toHaveBeenCalledWith({
    name: 'hike_resource_click',
    hikeId: 'hike-123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
    resourceType: 'live_position',
  })
  expect(trackHikeInteraction).toHaveBeenCalledTimes(1)
  fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
  expect(trackHikeInteraction).toHaveBeenCalledTimes(2)
})

test('inactive resource cards do not send events', () => {
  renderCards([{ type: 'live_position', state: 'inactive' }])
  fireEvent.click(screen.getByText(messages.en.Site.resourceTitles.live_position))
  expect(trackHikeInteraction).not.toHaveBeenCalled()
})

test('opening and reopening a video records one event per opening', () => {
  renderCards([{ type: 'youtube_video', url: 'https://youtu.be/abcdefghijk' }])
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(messages.en.Site.resourceTitles.youtube_video) }),
  )
  expect(trackHikeInteraction).toHaveBeenCalledWith({
    name: 'video_open',
    hikeId: 'hike-123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
  })
  expect(trackHikeInteraction).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Close video' }))
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(messages.en.Site.resourceTitles.youtube_video) }),
  )
  expect(trackHikeInteraction).toHaveBeenCalledTimes(2)
})

test.each([
  'https://example.com/film',
  'https://example.com/abcdefghijk',
  'https://youtu.be/incomplete',
])('keeps unsupported video URLs as external links: %s', (url) => {
  renderCards([{ type: 'youtube_video', url }])
  fireEvent.click(screen.getByRole('link'))
  expect(trackHikeInteraction).toHaveBeenCalledWith({
    name: 'video_open',
    hikeId: 'hike-123',
    hikeTitle: 'Kungsleden',
    locale: 'en',
  })
})
