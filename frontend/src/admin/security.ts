import 'server-only'

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'

import { adminConfig } from './config'

const derive = promisify(scrypt)
let database: DatabaseSync | undefined

function sessionDatabase() {
  if (!database) {
    mkdirSync(path.dirname(adminConfig.database), { recursive: true, mode: 0o700 })
    database = new DatabaseSync(adminConfig.database)
    database.exec(`PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, credential TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, at INTEGER NOT NULL);`)
  }
  return database
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function allowLogin() {
  const store = sessionDatabase()
  store.exec('BEGIN IMMEDIATE')
  try {
    store.prepare('DELETE FROM attempts WHERE at < ?').run(Date.now() - 15 * 60_000)
    const count = store.prepare('SELECT COUNT(*) AS count FROM attempts').get()?.count
    const allowed = typeof count === 'number' && count < 10
    if (allowed) {
      store.prepare('INSERT INTO attempts(at) VALUES (?)').run(Date.now())
    }
    store.exec('COMMIT')
    return allowed
  } catch (error) {
    store.exec('ROLLBACK')
    throw error
  }
}

export async function verifyPassword(password: string) {
  const [version, salt, encoded] = adminConfig.passwordHash.split(':')
  if (version !== 'scrypt' || !salt || !encoded || !/^[a-f0-9]{128}$/.test(encoded)) {
    return false
  }
  const actual = (await derive(password, salt, 64)) as Buffer
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex'))
}

export function createSession() {
  const token = randomBytes(32).toString('hex')
  const expires = Date.now() + adminConfig.sessionSeconds * 1000
  sessionDatabase().prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now())
  sessionDatabase()
    .prepare('INSERT INTO sessions VALUES (?, ?, ?)')
    .run(digest(token), expires, digest(adminConfig.passwordHash))
  return token
}

export async function hasSession() {
  const token = (await cookies()).get(adminConfig.cookie)?.value
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !adminConfig.passwordHash) {
    return false
  }
  const row = sessionDatabase()
    .prepare('SELECT expires, credential FROM sessions WHERE id = ?')
    .get(digest(token))
  return (
    row !== undefined &&
    typeof row.expires === 'number' &&
    row.expires > Date.now() &&
    row.credential === digest(adminConfig.passwordHash)
  )
}

export async function revokeSession() {
  const token = (await cookies()).get(adminConfig.cookie)?.value
  if (token) {
    sessionDatabase().prepare('DELETE FROM sessions WHERE id = ?').run(digest(token))
  }
}

export function validOrigin(request: Request) {
  const origin =
    adminConfig.origin || (process.env.NODE_ENV !== 'production' ? new URL(request.url).origin : '')
  return (
    Boolean(origin) &&
    request.headers.get('origin') === origin &&
    (process.env.NODE_ENV !== 'production' || origin.startsWith('https://'))
  )
}

export function sessionCookie() {
  return {
    httpOnly: true,
    secure: adminConfig.origin.startsWith('https://') || process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: adminConfig.sessionSeconds,
  }
}
