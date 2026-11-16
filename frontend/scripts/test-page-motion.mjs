/* global globalThis, window */
import assert from 'node:assert/strict'

import {
  cancelPageScroll,
  getAnchorScrollTarget,
  motionDuration,
  scrollToElement,
  subscribeAnchorScroll,
} from '../src/navigation/motion.ts'
import { collapsibleSections } from '../src/components/Markdown/collapsibleSections.ts'

let reduced = false
let durationToken = '.3s'
let nextFrame = 0
const frames = new Map()
Object.defineProperty(globalThis, 'performance', { value: { now: () => 0 }, configurable: true })
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++nextFrame, callback)
  return nextFrame
}
globalThis.cancelAnimationFrame = (id) => frames.delete(id)
globalThis.document = { documentElement: { scrollHeight: 2000 } }
globalThis.window = {
  scrollY: 100,
  innerHeight: 800,
  matchMedia: () => ({ matches: reduced }),
  scrollTo: ({ top, behavior }) => {
    assert.equal(behavior, 'instant')
    window.scrollY = top
  },
}
globalThis.getComputedStyle = () => ({
  scrollPaddingTop: '100px',
  getPropertyValue: () => durationToken,
})
const elementAt = (position) => ({
  getBoundingClientRect: () => ({ top: position - window.scrollY }),
})
function advance(time) {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) {
    callback(time)
  }
}

// Real compiled CSS normalizes milliseconds to seconds.
assert.equal(motionDuration({}), 300)
durationToken = '300ms'
assert.equal(motionDuration({}), 300)
durationToken = '.3s'

// Animate towards the target with the header offset, then stop on user input.
const interrupted = scrollToElement(elementAt(700))
advance(50)
assert.ok(window.scrollY > 100 && window.scrollY < 600)
cancelPageScroll()
assert.equal(frames.size, 0)
assert.equal(await interrupted, false)

// A new destination replaces the pending animation and clamps to the page bottom.
const superseded = scrollToElement(elementAt(700))
const completedScroll = scrollToElement(elementAt(1900))
assert.equal(await superseded, false)
assert.equal(frames.size, 1)
advance(300)
assert.equal(window.scrollY, 1200)
assert.equal(await completedScroll, true)
assert.equal(frames.size, 0)

// Closing work must wait until scrolling finishes, not just its first frame.
let closed = false
const sequence = scrollToElement(elementAt(700)).then(() => {
  closed = true
  return closed
})
advance(150)
assert.equal(closed, false)
advance(300)
await sequence
assert.equal(closed, true)

// Anchor navigation holds its destination until completion or user interruption.
const anchorStates = []
const unsubscribe = subscribeAnchorScroll(() => {
  anchorStates.push(getAnchorScrollTarget())
})
const firstTarget = elementAt(700)
const firstAnchor = scrollToElement(firstTarget, { anchor: true })
advance(150)
assert.equal(getAnchorScrollTarget(), firstTarget)
advance(300)
assert.equal(await firstAnchor, true)
assert.equal(getAnchorScrollTarget(), null)

const canceledAnchor = scrollToElement(firstTarget, { anchor: true })
advance(50)
cancelPageScroll()
assert.equal(await canceledAnchor, false)
assert.equal(getAnchorScrollTarget(), null)

const replacedAnchor = scrollToElement(firstTarget, { anchor: true })
const secondTarget = elementAt(900)
const replacement = scrollToElement(secondTarget, { anchor: true })
assert.equal(await replacedAnchor, false)
assert.equal(getAnchorScrollTarget(), secondTarget)
advance(300)
assert.equal(await replacement, true)
assert.equal(getAnchorScrollTarget(), null)
assert.deepEqual(anchorStates, [
  firstTarget,
  null,
  firstTarget,
  null,
  firstTarget,
  null,
  secondTarget,
  null,
])
unsubscribe()

// Other programmatic scrolling must not activate the anchor-only selection lock.
const ordinaryScroll = scrollToElement(firstTarget)
assert.equal(getAnchorScrollTarget(), null)
advance(300)
assert.equal(await ordinaryScroll, true)

// Reduced motion skips interpolation; targets above the page clamp to zero.
reduced = true
scrollToElement(elementAt(700), { anchor: true })
advance(0)
assert.equal(window.scrollY, 600)
assert.equal(getAnchorScrollTarget(), null)
scrollToElement(elementAt(0))
advance(0)
assert.equal(window.scrollY, 0)

const tree = {
  type: 'root',
  children: [
    { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Chapter one' }] },
    { type: 'element', tagName: 'p', children: [{ type: 'text', value: 'Keep all text' }] },
    { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Chapter two' }] },
  ],
}
const content = JSON.stringify(tree).match(/"value":"[^"]*"/g)
collapsibleSections()(tree)
assert.equal(tree.children.length, 2)
assert.ok(tree.children.every((node) => node.tagName === 'details' && !node.properties.open))
assert.deepEqual(JSON.stringify(tree).match(/"value":"[^"]*"/g), content)
process.stdout.write(
  'Page scrolling, anchor lifecycle, interruption, reduced motion, and closed chapter checks passed.\n',
)
