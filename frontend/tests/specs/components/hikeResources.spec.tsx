import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { messages } from '@/i18n/messages'

jest.mock('@/analytics/hikeEvents', () => ({ trackHikeInteraction: jest.fn() }))
jest.mock('@/app/[locale]/hikes/[slug]/components/VideoModal/VideoModal', () => ({
  VideoModal: ({ videoId }: { videoId: string }) => <div role="dialog">{videoId}</div>,
}))

test('keeps the film, packing list and route actions directly accessible in the overview', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <InfoCards
        presentation="compact"
        hikeId="test-hike"
        hikeTitle="Test hike"
        locale="en"
        cards={[
          { type: 'route', url: 'https://example.com/route' },
          { type: 'equipment', url: 'https://example.com/equipment' },
          { type: 'youtube_video', url: 'https://youtu.be/abcdefghijk' },
        ]}
      />
    </NextIntlClientProvider>,
  )
  expect(screen.getByRole('link', { name: /Detailed equipment list/ })).toHaveAttribute(
    'href',
    'https://example.com/equipment',
  )
  expect(screen.getByRole('link', { name: /Route details/ })).toHaveAttribute(
    'href',
    'https://example.com/route',
  )
  const resourceActions = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')]
  expect(resourceActions[0]).toHaveAccessibleName(/Route details/)
  expect(resourceActions[1]).toHaveAccessibleName(/Detailed equipment list/)
  expect(
    resourceActions[0].compareDocumentPosition(resourceActions[1]) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(
    resourceActions[1].compareDocumentPosition(resourceActions[2]) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Film from the hike/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('abcdefghijk')
  expect(trackHikeInteraction).toHaveBeenCalledWith({
    name: 'video_open',
    hikeId: 'test-hike',
    hikeTitle: 'Test hike',
    locale: 'en',
  })
})
