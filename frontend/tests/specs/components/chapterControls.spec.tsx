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
  await screen.findByRole('button', { name: 'Collapse all chapters' })
  const story = document.getElementById('story')
  if (!story) {
    throw new Error('Missing story section')
  }
  const bounds = jest.spyOn(story, 'getBoundingClientRect')
  bounds.mockReturnValue(new DOMRect(0, 800, 400, 200))
  fireEvent.keyDown(window, { key: 'c' })
  expect(chapters.every((chapter) => chapter.open)).toBe(true)
  bounds.mockReturnValue(new DOMRect(0, -100, 400, 200))
  fireEvent.keyDown(window, { key: 'c' })
  await waitFor(() => {
    expect(chapters.every((chapter) => !chapter.open)).toBe(true)
  })
  fireEvent.click(screen.getByText('Preparation'))
  expect(chapters[0]).toHaveAttribute('open')
  expect(chapters[0]).toHaveAttribute('data-expanded', 'true')
})
