import {
  cancelPageScroll,
  getAnchorScrollTarget,
  motionDuration,
  scrollToElement,
  subscribeAnchorScroll,
} from '@/navigation/motion'

let reduced = false
let durationToken = '.3s'
let targetMargin = '0px'
let nextFrame = 0
const frames = new Map<number, FrameRequestCallback>()
const subscriptions: (() => void)[] = []
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')

function elementAt(position: number) {
  const element = document.createElement('section')
  jest
    .spyOn(element, 'getBoundingClientRect')
    .mockImplementation(() => new DOMRect(0, position - window.scrollY))
  return element
}

function advance(time: number) {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) {
    callback(time)
  }
}

beforeEach(() => {
  reduced = false
  durationToken = '.3s'
  targetMargin = '0px'
  nextFrame = 0
  frames.clear()
  jest.spyOn(performance, 'now').mockReturnValue(0)
  jest.replaceProperty(window, 'scrollY', 100)
  jest.replaceProperty(window, 'innerHeight', 800)
  jest.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({ matches: reduced })),
  })
  jest.spyOn(window, 'getComputedStyle').mockImplementation(() => {
    const style = document.createElement('div').style
    style.scrollPaddingTop = '100px'
    style.scrollMarginTop = targetMargin
    style.setProperty('--duration-motion', durationToken)
    return style
  })
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  jest.spyOn(window, 'scrollTo').mockImplementation((options: ScrollToOptions | number) => {
    if (typeof options === 'number') {
      throw new TypeError('Expected scroll options')
    }
    expect(options.behavior).toBe('instant')
    window.scrollY = options.top ?? 0
  })
})

afterEach(() => {
  for (const unsubscribe of subscriptions.splice(0)) {
    unsubscribe()
  }
  cancelPageScroll()
  jest.restoreAllMocks()
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia)
  } else {
    Reflect.deleteProperty(window, 'matchMedia')
  }
})

describe('motion duration', () => {
  test.each(['.3s', '300ms'])('reads the CSS duration %s in milliseconds', (token) => {
    durationToken = token
    expect(motionDuration(document.documentElement)).toBe(300)
  })

  test.each([
    ['missing token', ''],
    ['unrecognized token', 'invalid'],
  ])('uses zero duration for %s', (_case, token) => {
    durationToken = token
    expect(motionDuration(document.documentElement)).toBe(0)
  })

  test('disables duration when reduced motion is requested', () => {
    reduced = true
    expect(motionDuration(document.documentElement)).toBe(0)
  })
})

describe('page scrolling', () => {
  test('aligns targets with an explicit margin directly below the header', async () => {
    targetMargin = '64px'
    const completed = scrollToElement(elementAt(700), { anchor: true })
    advance(300)
    await expect(completed).resolves.toBe(true)
    expect(window.scrollY).toBe(636)
  })

  test('keeps the selected anchor aligned when the menu closes and the chapter moves', async () => {
    let chapterTop = 700
    const chapter = document.createElement('details')
    jest
      .spyOn(chapter, 'getBoundingClientRect')
      .mockImplementation(() => new DOMRect(0, chapterTop - window.scrollY))

    const completed = scrollToElement(chapter, { anchor: true })
    chapterTop = 740
    advance(150)
    chapterTop = 760
    advance(300)

    await expect(completed).resolves.toBe(true)
    expect(window.scrollY).toBe(660)
  })

  test('interpolates toward the header offset and stops when canceled', async () => {
    const interrupted = scrollToElement(elementAt(700))
    advance(50)
    expect(window.scrollY).toBeGreaterThan(100)
    expect(window.scrollY).toBeLessThan(600)

    cancelPageScroll()
    expect(frames.size).toBe(0)
    await expect(interrupted).resolves.toBe(false)
  })

  test('replaces a pending destination and clamps to the bottom of the page', async () => {
    const superseded = scrollToElement(elementAt(700))
    const completed = scrollToElement(elementAt(1900))
    await expect(superseded).resolves.toBe(false)
    expect(frames.size).toBe(1)

    advance(300)
    expect(window.scrollY).toBe(1200)
    await expect(completed).resolves.toBe(true)
    expect(frames.size).toBe(0)
  })

  test('waits for the final frame before running completion work', async () => {
    const closed = jest.fn()
    const sequence = scrollToElement(elementAt(700)).then(closed)

    advance(150)
    await Promise.resolve()
    expect(closed).not.toHaveBeenCalled()

    advance(300)
    await sequence
    expect(window.scrollY).toBe(600)
    expect(closed).toHaveBeenCalledWith(true)
  })

  test('does not acquire the anchor navigation lock for ordinary scrolling', async () => {
    const completed = scrollToElement(elementAt(700))
    expect(getAnchorScrollTarget()).toBeNull()

    advance(300)
    await expect(completed).resolves.toBe(true)
  })

  test('skips interpolation for reduced motion and clamps above-page targets to zero', async () => {
    reduced = true
    const anchor = scrollToElement(elementAt(700), { anchor: true })
    advance(0)
    expect(window.scrollY).toBe(600)
    expect(getAnchorScrollTarget()).toBeNull()
    await expect(anchor).resolves.toBe(true)

    const top = scrollToElement(elementAt(0))
    advance(0)
    expect(window.scrollY).toBe(0)
    await expect(top).resolves.toBe(true)
  })
})

describe('anchor scrolling lifecycle', () => {
  test('holds the destination until completion, cancellation, or replacement', async () => {
    const states: (HTMLElement | null)[] = []
    subscriptions.push(subscribeAnchorScroll(() => states.push(getAnchorScrollTarget())))
    const firstTarget = elementAt(700)
    const first = scrollToElement(firstTarget, { anchor: true })
    advance(150)
    expect(getAnchorScrollTarget()).toBe(firstTarget)
    advance(300)
    await expect(first).resolves.toBe(true)
    expect(getAnchorScrollTarget()).toBeNull()

    const canceled = scrollToElement(firstTarget, { anchor: true })
    advance(50)
    cancelPageScroll()
    await expect(canceled).resolves.toBe(false)
    expect(getAnchorScrollTarget()).toBeNull()

    const replaced = scrollToElement(firstTarget, { anchor: true })
    const secondTarget = elementAt(900)
    const replacement = scrollToElement(secondTarget, { anchor: true })
    await expect(replaced).resolves.toBe(false)
    expect(getAnchorScrollTarget()).toBe(secondTarget)
    advance(300)
    await expect(replacement).resolves.toBe(true)
    expect(getAnchorScrollTarget()).toBeNull()
    expect(states).toEqual([
      firstTarget,
      null,
      firstTarget,
      null,
      firstTarget,
      null,
      secondTarget,
      null,
    ])
  })

  test('stops notifying a listener after it unsubscribes', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeAnchorScroll(listener)
    subscriptions.push(unsubscribe)
    unsubscribe()

    const completed = scrollToElement(elementAt(700), { anchor: true })
    advance(300)
    await expect(completed).resolves.toBe(true)
    expect(listener).not.toHaveBeenCalled()
  })
})
