import { positionMotion } from '@/app/[locale]/hikes/[slug]/components/DynamicHikeMap/positionMotion'

const trail = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
]
const start = { line: 0, edge: 0, coordinates: [0.5, 0] }
const finish = { line: 0, edge: 1, coordinates: [1, 0.5] }

test('moves along both sides of a bend and can resume from an intermediate position', () => {
  const sample = positionMotion(trail, start, finish)
  expect(sample?.(0.25).coordinates).toEqual([0.75, 0])
  const current = sample?.(0.75)
  expect(current).toEqual({ line: 0, edge: 1, coordinates: [1, 0.25] })
  if (!current) {
    throw new Error('Expected an intermediate position')
  }
  expect(positionMotion(trail, current, finish)?.(0.5).coordinates).toEqual([1, 0.375])
  expect(sample?.(1)).toEqual(finish)
})

test('follows the trail backwards in replay', () => {
  const sample = positionMotion(trail, finish, start)
  expect(sample?.(0.25).coordinates).toEqual([1, 0.25])
  expect(sample?.(0.75).coordinates).toEqual([0.75, 0])
  expect(sample?.(1)).toEqual(start)
})

test('does not animate a stationary point', () => {
  expect(positionMotion(trail, start, start)).toBeUndefined()
})
