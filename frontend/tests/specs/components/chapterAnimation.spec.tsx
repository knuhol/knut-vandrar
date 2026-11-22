import { act, fireEvent, render, screen } from '@testing-library/react'

import { Chapter } from '@/components/Chapter/Chapter'

jest.mock('@/navigation/motion', () => ({
  cancelPageScroll: jest.fn(),
  motionDuration: () => 300,
  scrollToElement: jest.fn().mockResolvedValue(true),
}))

type AnimationStub = { onfinish: (() => void) | null; cancel: () => void }
const animations: AnimationStub[] = []
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')

beforeEach(() => {
  animations.length = 0
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: jest.fn(() => {
      const animation: AnimationStub = { onfinish: null, cancel: jest.fn() }
      animations.push(animation)
      return animation as unknown as Animation
    }),
  })
})

afterEach(() => {
  if (originalAnimate) {
    Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  }
})

test('starts closing the disclosure indicator with the content rather than after it finishes', () => {
  const { container } = render(
    <Chapter>
      <summary>Preparation</summary>
      <p>Chapter text</p>
    </Chapter>,
  )
  const details = container.querySelector('details')
  if (!details) {
    throw new Error('Missing chapter')
  }
  details.style.borderTopWidth = '0px'
  details.style.borderBottomWidth = '0px'
  jest
    .spyOn(details, 'getBoundingClientRect')
    .mockImplementation(() => new DOMRect(0, 100, 500, details.open ? 120 : 32))
  const summary = screen.getByText('Preparation')
  fireEvent.click(summary)
  expect(details).toHaveAttribute('data-expanded', 'true')
  act(() => {
    animations[0].onfinish?.()
  })
  fireEvent.click(summary)
  expect(details).toHaveAttribute('open')
  expect(details).toHaveAttribute('data-expanded', 'false')
  expect(summary.style.getPropertyValue('--chapter-toggle-duration')).toBe('300ms')
  act(() => {
    animations[1].onfinish?.()
  })
  expect(details).not.toHaveAttribute('open')
})
