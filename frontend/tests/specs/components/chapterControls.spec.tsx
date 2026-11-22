import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { Chapter } from '@/components/Chapter/Chapter'
import { ChapterControls } from '@/components/Chapter/ChapterControls'
import { messages } from '@/i18n/messages'

jest.mock('@/navigation/motion', () => ({
  cancelPageScroll: jest.fn(),
  motionDuration: () => 0,
  scrollToElement: jest.fn().mockResolvedValue(true),
}))

test('expands and collapses all chapters, keeping individual chapter controls synchronized', async () => {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <section id="story">
        <ChapterControls targetId="story" />
        <Chapter>
          <summary>Preparation</summary>
          <p>Preparing</p>
        </Chapter>
        <Chapter>
          <summary>On the trail</summary>
          <p>Walking</p>
        </Chapter>
      </section>
    </NextIntlClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Expand all chapters' }))
  await screen.findByRole('button', { name: 'Collapse all chapters' })
  const chapters = [...container.querySelectorAll('details')]
  expect(chapters.every((chapter) => chapter.open)).toBe(true)
  fireEvent.click(screen.getByText('Preparation'))
  await screen.findByRole('button', { name: 'Expand all chapters' })
  expect(chapters[0]).not.toHaveAttribute('open')
  fireEvent.click(screen.getByRole('button', { name: 'Expand all chapters' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Collapse all chapters' }))
  await waitFor(() => {
    expect(chapters.every((chapter) => !chapter.open)).toBe(true)
  })
  fireEvent.click(screen.getByText('Preparation'))
  expect(chapters[0]).toHaveAttribute('open')
  expect(chapters[0]).toHaveAttribute('data-expanded', 'true')
})
