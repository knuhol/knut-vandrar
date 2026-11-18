import 'server-only'

import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'

import { previewConfig } from './config'

const derive = promisify(scrypt)

export async function verifyPreviewPassword(password: string) {
  const [version, salt, hash] = previewConfig.passwordHash.split(':')
  if (
    version !== 'scrypt' ||
    !/^[a-f0-9]{64}$/.test(salt || '') ||
    !/^[a-f0-9]{128}$/.test(hash || '')
  ) {
    return false
  }
  const actual = (await derive(password, salt, 64)) as Buffer
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}

function signature(payload: string) {
  return createHmac('sha256', previewConfig.passwordHash).update(payload).digest('hex')
}

export function previewSession() {
  const payload = `${String(Date.now() + previewConfig.sessionSeconds * 1000)}.${randomBytes(16).toString('hex')}`
  return `${payload}.${signature(payload)}`
}

export function validPreviewSession(token: string | undefined) {
  if (
    !previewConfig.passwordHash ||
    !token ||
    !/^\d{13}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)
  ) {
    return false
  }
  const [expires, nonce, signed] = token.split('.')
  return (
    Number(expires) > Date.now() &&
    timingSafeEqual(
      Buffer.from(signed, 'hex'),
      Buffer.from(signature(`${expires}.${nonce}`), 'hex'),
    )
  )
}

// A separate persistent throttle keeps preview attempts independent of admin login.
export function allowPreviewLogin() {
  mkdirSync(path.dirname(previewConfig.database), { recursive: true, mode: 0o700 })
  const database = new DatabaseSync(previewConfig.database)
  try {
    database.exec(
      'PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS attempts (at INTEGER NOT NULL); BEGIN IMMEDIATE;',
    )
    database.prepare('DELETE FROM attempts WHERE at < ?').run(Date.now() - 15 * 60_000)
    const count = database.prepare('SELECT COUNT(*) AS count FROM attempts').get()?.count
    const allowed = typeof count === 'number' && count < 10
    if (allowed) {
      database.prepare('INSERT INTO attempts VALUES (?)').run(Date.now())
    }
    database.exec('COMMIT')
    return allowed
  } finally {
    database.close()
  }
}

export function resetPreviewLoginAttempts() {
  const database = new DatabaseSync(previewConfig.database)
  try {
    database.exec('PRAGMA busy_timeout = 5000; DELETE FROM attempts;')
  } finally {
    database.close()
  }
}

export function publicPreviewAsset(uri: string, method: string) {
  if (method === 'POST') {
    return uri === '/api/preview/login'
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return false
  }
  try {
    const decoded = decodeURIComponent(new URL(uri, previewConfig.origin).pathname)
    if (/[\\%]/.test(decoded)) {
      return false
    }
    const pathname = new URL(decoded, previewConfig.origin).pathname
    return (
      pathname === '/preview' ||
      pathname === '/robots.txt' ||
      pathname === '/brand/forest.svg' ||
      pathname.startsWith('/_next/static/')
    )
  } catch {
    return false
  }
}
