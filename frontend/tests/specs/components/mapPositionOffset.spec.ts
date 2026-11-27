import { positionOffset } from '@/app/[locale]/hikes/[slug]/components/DynamicHikeMap/positionOffset'

test('keeps the marker centered when the panel does not cover it', () => {
  const viewport = new DOMRect(20, 200, 800, 450)
  const panel = new DOMRect(28, 208, 280, 250)
  const controls = new DOMRect(650, 572, 160, 44)

  expect(positionOffset(viewport, panel, controls)).toEqual([0, 0])
})

test('keeps the same mobile anchor when the live tracking rows change', () => {
  const viewport = new DOMRect(20, 200, 320, 560)
  const activePanel = new DOMRect(28, 208, 285, 190)
  const inactivePanel = new DOMRect(28, 208, 245, 108)
  const controls = new DOMRect(174, 708, 158, 44)
  const activeOffset = positionOffset(viewport, activePanel, controls)
  const markerY = viewport.top + viewport.height / 2 + activeOffset[1]

  expect(positionOffset(viewport, inactivePanel, controls)).toEqual(activeOffset)
  expect(activeOffset).toEqual([0, 84])
  expect(markerY).toBeGreaterThan(activePanel.bottom)
  expect(markerY).toBeLessThan(controls.top)
})

test('uses the space beside the panel when there is little room below it', () => {
  const viewport = new DOMRect(0, 0, 500, 260)
  const panel = new DOMRect(8, 8, 305, 190)
  const controls = new DOMRect(332, 210, 160, 44)

  expect(positionOffset(viewport, panel, controls)).toEqual([156.5, 0])
})

test('uses the true center with the info panel collapsed', () => {
  const viewport = new DOMRect(20, 200, 320, 320)
  const controls = new DOMRect(174, 468, 158, 44)

  expect(positionOffset(viewport, undefined, controls)).toEqual([0, 0])
})
