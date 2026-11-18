/** @jest-environment node */
import { scryptSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'

import { GET as access } from '@/app/api/preview/access/route'
import { POST as login } from '@/app/api/preview/login/route'
import { previewConfig, previewDestination } from '@/preview/config'
import {
  allowPreviewLogin,
  previewSession,
  publicPreviewAsset,
  validPreviewSession,
  verifyPreviewPassword,
} from '@/preview/security'

jest.mock('server-only', () => ({}))
jest.mock('@/config/server', () => ({ serverConfig: { deploymentEnvironment: 'dev' } }))

const directory = mkdtempSync(path.join(tmpdir(), 'knut-preview-'))
const password = 'temporary-preview-test-password'
const salt = 'a'.repeat(64)
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`
let sequence = 0

beforeEach(() => {
  previewConfig.enabled = true
  previewConfig.passwordHash = hash
  previewConfig.database = path.join(directory, `attempts-${String(sequence++)}.sqlite`)
})
afterAll(() => {
  rmSync(directory, { recursive: true, force: true })
})

function check(uri: string, token?: string, method = 'GET', host = 'dev.vandrar.se') {
  return Promise.resolve(
    access(
      new NextRequest('http://frontend/api/preview/access', {
        headers: {
          'x-forwarded-host': host,
          'x-forwarded-uri': uri,
          'x-forwarded-method': method,
          ...(token ? { cookie: `${previewConfig.cookie}=${token}` } : {}),
        },
      }),
    ),
  )
}

function submit(value: string, origin = previewConfig.origin, next = '/en') {
  return login(
    new Request('http://frontend/api/preview/login', {
      method: 'POST',
      headers: {
        host: 'dev.vandrar.se',
        origin,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ password: value, next }),
    }),
  )
}

test('verifies the separate scrypt password and rejects invalid configuration', async () => {
  expect(await verifyPreviewPassword(password)).toBe(true)
  expect(await verifyPreviewPassword('wrong')).toBe(false)
  previewConfig.passwordHash = 'invalid'
  expect(await verifyPreviewPassword(password)).toBe(false)
})

test('sessions expire, reject tampering, and stop working after password rotation', () => {
  const token = previewSession()
  expect(validPreviewSession(token)).toBe(true)
  expect(validPreviewSession(`${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`)).toBe(false)
  previewConfig.passwordHash = `${hash}changed`
  expect(validPreviewSession(token)).toBe(false)
  previewConfig.passwordHash = hash
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + previewConfig.sessionSeconds * 1000 + 1)
  expect(validPreviewSession(token)).toBe(false)
})

test('protects pages, media, API reads, and admin until the gate is unlocked', async () => {
  expect((await check('/en/hikes/trail?view=1')).headers.get('location')).toBe(
    'https://dev.vandrar.se/preview?next=%2Fen%2Fhikes%2Ftrail%3Fview%3D1',
  )
  expect((await check('/admin')).status).toBe(303)
  expect((await check('/api/hikes')).status).toBe(401)
  expect((await check('/api/media/photo.webp')).status).toBe(401)
  expect((await check('/brand/sharing/en.png')).status).toBe(303)
  const authenticated = await check('/api/media/photo.webp', previewSession())
  expect(authenticated.status).toBe(200)
  expect(authenticated.headers.get('cache-control')).toContain('no-store')
})

test('allows only the gate, its static assets, and login without a session', async () => {
  for (const uri of [
    '/preview?next=%2Fen',
    '/brand/forest.svg',
    '/_next/static/chunks/page.js',
    '/robots.txt',
  ]) {
    expect((await check(uri)).status).toBe(200)
  }
  expect((await check('/api/preview/login', undefined, 'POST')).status).toBe(200)
  expect(publicPreviewAsset('/_next/static/%2e%2e/%2e%2e/api/hikes', 'GET')).toBe(false)
  expect(publicPreviewAsset('/_next/static/chunks/page.js', 'POST')).toBe(false)
  expect(publicPreviewAsset('/_next/image?url=/knut.webp', 'GET')).toBe(false)
})

test('is confined to the dev hostname and dev environment', async () => {
  expect((await check('/', undefined, 'GET', 'knut.vandrar.se')).status).toBe(404)
  expect((await check('/', undefined, 'GET', 'localhost:3000')).status).toBe(404)
  previewConfig.enabled = false
  expect((await check('/')).status).toBe(404)
  expect((await submit(password)).status).toBe(404)
})

test('login sets a secure host-only cookie and returns to the requested page', async () => {
  const response = await submit(password, previewConfig.origin, '/cs/hiky/trail')
  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe('https://dev.vandrar.se/cs/hiky/trail')
  const cookie = response.headers.get('set-cookie') || ''
  expect(cookie).toContain('__Host-dev_access=')
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('Secure')
  expect(cookie).toContain('SameSite=strict')
  expect(cookie).not.toContain('Domain=')
  expect(cookie).not.toContain(password)
})

test('denies invalid passwords, cross-origin requests, oversized bodies, and missing credentials', async () => {
  const wrong = await submit('wrong')
  expect(wrong.headers.get('set-cookie')).toBeNull()
  expect(wrong.headers.get('location')).toContain('error=password')
  expect((await submit(password, 'https://elsewhere.example')).status).toBe(403)
  expect((await submit('a'.repeat(5000))).status).toBe(400)
  previewConfig.passwordHash = ''
  expect((await submit(password)).headers.get('location')).toContain('error=unavailable')
  expect((await check('/')).status).toBe(303)
})

test('throttle persists across requests and releases after fifteen minutes', () => {
  for (let index = 0; index < 10; index++) {
    expect(allowPreviewLogin()).toBe(true)
  }
  expect(allowPreviewLogin()).toBe(false)
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 15 * 60_000 + 1)
  expect(allowPreviewLogin()).toBe(true)
})

test.each([
  'https://elsewhere.example',
  '//elsewhere.example',
  '/\\elsewhere.example',
  '/preview',
  '/\nLocation: elsewhere',
])('does not permit an unsafe return URL: %p', (value) => {
  expect(previewDestination(value)).toBe('/')
})
