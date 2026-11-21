/** @jest-environment node */

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { localDateTime, utcDateTime } from '@/admin/dateTime'

describe('admin date/time conversion in Europe/Stockholm', () => {
  test.each([
    ['2026-01-15T12:34:56.123Z', '2026-01-15T13:34:56.123'],
    ['2026-07-15T12:34:56.123Z', '2026-07-15T14:34:56.123'],
    ['2026-12-31T23:30:00Z', '2027-01-01T00:30:00.000'],
  ])('displays %s as local time %s', (utc, local) => {
    expect(localDateTime(utc)).toBe(local)
  })

  test.each([
    ['2026-01-15T13:34', '2026-01-15T12:34:00.000Z'],
    ['2026-07-15T14:34:56.123', '2026-07-15T12:34:56.123Z'],
    ['2026-01-15T13:34:56', '2026-01-15T12:34:56.000Z'],
    ['2026-01-15T13:34:56.1', '2026-01-15T12:34:56.100Z'],
    ['2026-01-15T13:34:56.12', '2026-01-15T12:34:56.120Z'],
    ['2028-02-29T13:34', '2028-02-29T12:34:00.000Z'],
  ])('saves %s as UTC %s', (local, utc) => {
    expect(utcDateTime(local)).toBe(utc)
  })

  test.each([
    ['daylight-saving gap', '2026-03-29T02:30'],
    ['February 30', '2026-02-30T10:00'],
    ['February 29 in a non-leap year', '2026-02-29T10:00'],
    ['hour outside range', '2026-01-15T24:00'],
    ['minute outside range', '2026-01-15T13:60'],
    ['empty input', ''],
    ['unrecognized date', 'invalid'],
    ['UTC suffix on a local time', '2026-01-15T10:00Z'],
    ['offset suffix on a local time', '2026-01-15T10:00+01:00'],
    ['submillisecond precision', '2026-01-15T13:34:56.1234'],
  ])('rejects local time with %s', (_case, value) => {
    expect(utcDateTime(value)).toBeUndefined()
  })

  test.each([
    ['empty input', ''],
    ['unrecognized date', 'invalid'],
  ])('clears stored dates with %s', (_case, value) => {
    expect(localDateTime(value)).toBe('')
  })
})

test('round-trips time zones with a fractional-hour offset', () => {
  // Jest virtualizes process.env; a child process gives Date a real, isolated TZ.
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../../src/admin/dateTime.ts')).href
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import { localDateTime, utcDateTime } from ${JSON.stringify(moduleUrl)};
       process.stdout.write(JSON.stringify([
         localDateTime('2026-01-15T12:00:00Z'),
         utcDateTime('2026-01-15T17:45'),
       ]));`,
    ],
    { env: { ...process.env, TZ: 'Asia/Kathmandu' }, encoding: 'utf8' },
  )

  expect(JSON.parse(output)).toEqual(['2026-01-15T17:45:00.000', '2026-01-15T12:00:00.000Z'])
})
