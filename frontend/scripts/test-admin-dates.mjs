import assert from 'node:assert/strict'

import { localDateTime, utcDateTime } from '../src/admin/dateTime.ts'

const previousTimezone = process.env.TZ
try {
  process.env.TZ = 'Europe/Stockholm'
  assert.equal(localDateTime('2026-01-15T12:34:56.123Z'), '2026-01-15T13:34:56.123')
  assert.equal(localDateTime('2026-07-15T12:34:56.123Z'), '2026-07-15T14:34:56.123')
  assert.equal(utcDateTime('2026-01-15T13:34'), '2026-01-15T12:34:00.000Z')
  assert.equal(utcDateTime('2026-07-15T14:34:56.123'), '2026-07-15T12:34:56.123Z')
  assert.equal(utcDateTime('2026-03-29T02:30'), undefined)
  assert.equal(utcDateTime('2026-02-30T10:00'), undefined)
  assert.equal(utcDateTime(''), undefined)
  assert.equal(utcDateTime('2026-01-15T10:00Z'), undefined)
  process.env.TZ = 'Asia/Kathmandu'
  assert.equal(localDateTime('2026-01-15T12:00:00Z'), '2026-01-15T17:45:00.000')
  assert.equal(utcDateTime('2026-01-15T17:45'), '2026-01-15T12:00:00.000Z')
  process.stdout.write('Admin local-time conversion checks passed.\n')
} finally {
  if (previousTimezone === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = previousTimezone
  }
}
