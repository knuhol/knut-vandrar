import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { Chapter } from '@/components/Chapter/Chapter'
import { setDisclosureExpanded } from '@/components/Disclosure/disclosureState'
import { TrailRatings } from '@/app/[locale]/hikes/[slug]/components/TrailRatings'
import { messages } from '@/i18n/messages'

jest.mock('@/navigation/motion', () => ({
  cancelPageScroll: jest.fn(),
  motionDuration: () => 300,
  scrollToElement: jest.fn().mockResolvedValue(true),
}))

type AnimationStub = {
  onfinish: (() => void) | null
  cancel: () => void
  pause: () => void
  play: () => void
}
const animations: AnimationStub[] = []
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
const animate = jest.fn<ReturnType<HTMLElement['animate']>, Parameters<HTMLElement['animate']>>(
  () => {
    const animation: AnimationStub = {
      onfinish: null,
      cancel: jest.fn(),
      pause: jest.fn(),
      play: jest.fn(),
    }
    animations.push(animation)
    return animation as unknown as Animation
  },
)

beforeEach(() => {
  animations.length = 0
  animate.mockClear()
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
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
      <summary>
        Preparation
        <span data-disclosure-arrow aria-hidden="true" />
      </summary>
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
  const arrow = summary.querySelector('[data-disclosure-arrow]')
  expect(animate.mock.contexts).toEqual([details, arrow, details, arrow])
  expect(animate.mock.calls.map(([, timing]) => timing)).toEqual(
    Array.from({ length: 4 }, () => ({ duration: 300, easing: 'ease-out', fill: 'backwards' })),
  )
  act(() => {
    animations[2].onfinish?.()
  })
  expect(details).not.toHaveAttribute('open')
})

test('an explicit chapter toggle uses the same height and arrow animation', () => {
  const { container } = render(
    <Chapter>
      <summary>
        Preparation
        <span data-disclosure-arrow aria-hidden="true" />
      </summary>
      <p>Chapter text</p>
    </Chapter>,
  )
  const details = container.querySelector('details')
  if (!details) {
    throw new Error('Missing chapter')
  }

  jest
    .spyOn(details, 'getBoundingClientRect')
    .mockImplementation(() => new DOMRect(0, 0, 500, details.open ? 120 : 32))
  setDisclosureExpanded(details, true)
  expect(details).toHaveAttribute('open')
  expect(animate).toHaveBeenCalledTimes(2)
  expect(animate).toHaveBeenNthCalledWith(1, [{ height: '32px' }, { height: '120px' }], {
    duration: 300,
    easing: 'ease-out',
    fill: 'backwards',
  })

  setDisclosureExpanded(details, false)
  expect(details).toHaveAttribute('open')
  expect(details).toHaveAttribute('data-expanded', 'false')
  expect(animate).toHaveBeenCalledTimes(4)
  animations[2].onfinish?.()
  expect(details).not.toHaveAttribute('open')
})

test('closing a chapter clears pointer focus and preserves keyboard focus', () => {
  render(
    <Chapter>
      <summary tabIndex={0}>Preparation</summary>
      <p>Chapter text</p>
    </Chapter>,
  )
  const summary = screen.getByText('Preparation')
  fireEvent.click(summary)
  summary.focus()

  fireEvent.click(summary, { detail: 0 })
  animations[1].onfinish?.()
  expect(summary).toHaveFocus()

  fireEvent.click(summary)
  fireEvent.click(summary, { detail: 1 })
  expect(summary).toHaveFocus()
  animations[3].onfinish?.()
  expect(summary).not.toHaveFocus()
})

test('rating information animates when the info icon is clicked', () => {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <TrailRatings
        ratings={{
          facilities: 6,
          maintenance: null,
          resupplies: null,
          publicTransport: null,
          difficulty: null,
        }}
      />
    </NextIntlClientProvider>,
  )
  const details = container.querySelector('details')
  const summary = details?.querySelector('summary')
  const icon = summary?.querySelector('svg')
  if (!details || !summary || !icon) {
    throw new Error('Missing rating info disclosure')
  }

  const focus = jest.spyOn(summary, 'focus')
  fireEvent.mouseDown(icon, { button: 0 })
  fireEvent.click(icon)
  expect(focus).not.toHaveBeenCalled()
  expect(details).toHaveAttribute('open')
  expect(animate.mock.contexts).toEqual([details])

  fireEvent.click(icon)
  expect(details).toHaveAttribute('open')
  expect(animate.mock.contexts).toEqual([details, details])
  animations[1].onfinish?.()
  expect(details).not.toHaveAttribute('open')
})
