import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { DatabaseSync } from 'node:sqlite'

const temporary = mkdtempSync(path.join(tmpdir(), 'knut-admin-test-'))
const password = randomBytes(24).toString('hex')
const salt = randomBytes(32).toString('hex')
const token = randomBytes(32).toString('hex')
let calls = 0
const backend = createServer((request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`)
  calls++
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ items: [], total: 0 }))
})
backend.listen(0, '127.0.0.1')
await once(backend, 'listening')
const portServer = createServer()
portServer.listen(0, '127.0.0.1')
await once(portServer, 'listening')
const port = portServer.address().port
await new Promise((resolve) => {
  portServer.close(resolve)
})
const origin = `http://127.0.0.1:${port}`
const child = spawn(
  process.execPath,
  [
    '../node_modules/next/dist/bin/next',
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
      API_WRITE_TOKEN: token,
      ADMIN_ORIGIN: origin,
      ADMIN_SESSION_DATABASE: path.join(temporary, 'sessions.sqlite'),
      INTERNAL_API_URL: `http://127.0.0.1:${backend.address().port}`,
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
)
let output = ''
child.stdout.on('data', (chunk) => {
  output += chunk.toString()
})
child.stderr.on('data', (chunk) => {
  output += chunk.toString()
})
async function call(route, method = 'GET', body, cookie, requestOrigin = origin) {
  return fetch(`${origin}${route}`, {
    method,
    headers: {
      Origin: requestOrigin,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })
}
try {
  let ready = false
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await call('/api/admin/auth')
      if (response.ok) {
        ready = true
        break
      }
    } catch {
      /* Server is still starting. */
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 500)
    })
  }
  assert.ok(ready, 'Admin test server must start')
  assert.equal((await call('/api/admin/backend/hikes')).status, 401)
  assert.equal(
    (await call('/api/admin/auth', 'POST', { password }, undefined, 'https://evil.example')).status,
    403,
  )
  assert.equal((await call('/api/admin/auth', 'POST', { password: 'wrong' })).status, 401)
  const login = await call('/api/admin/auth', 'POST', { password })
  assert.equal(login.status, 200)
  const cookieHeader = login.headers.get('set-cookie')
  assert.match(cookieHeader, /HttpOnly/i)
  assert.match(cookieHeader, /SameSite=strict/i)
  const cookie = cookieHeader.split(';')[0]
  assert.deepEqual(await (await call('/api/admin/auth', 'GET', undefined, cookie)).json(), {
    authenticated: true,
  })
  assert.equal((await call('/api/admin/backend/hikes', 'GET', undefined, cookie)).status, 200)
  assert.equal(calls, 1)
  assert.equal(
    (await call('/api/admin/backend/hikes', 'POST', {}, cookie, 'https://evil.example')).status,
    403,
  )
  assert.equal((await call('/api/admin/backend/not-an-api', 'GET', undefined, cookie)).status, 404)
  const page = await call('/admin', 'GET', undefined, cookie)
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.ok(!html.includes(token), 'Permanent token must never appear in HTML')
  assert.ok(!html.includes(password), 'Password must never appear in HTML')
  assert.ok(html.includes('knut-vandrar'), 'Admin must render')
  assert.equal((await call('/api/admin/auth', 'DELETE', undefined, cookie)).status, 200)
  assert.equal((await call('/api/admin/backend/hikes', 'GET', undefined, cookie)).status, 401)
  const second = await call('/api/admin/auth', 'POST', { password })
  const secondCookie = second.headers.get('set-cookie').split(';')[0]
  const database = new DatabaseSync(path.join(temporary, 'sessions.sqlite'))
  database.exec('UPDATE sessions SET expires = 0')
  assert.equal((await call('/api/admin/backend/hikes', 'GET', undefined, secondCookie)).status, 401)
  database.close()
  for (let attempt = 0; attempt < 7; attempt++) {
    await call('/api/admin/auth', 'POST', { password: 'wrong' })
  }
  assert.equal((await call('/api/admin/auth', 'POST', { password })).status, 429)
  process.stdout.write(
    'Admin integration checks passed: login, origin protection, token isolation, API allowlist, logout revocation, expiration and rate limiting.\n',
  )
} catch (error) {
  throw new Error(
    `Admin integration failed: ${error.message}. Captured ${output.length} server-log characters (not printed).`,
    { cause: error },
  )
} finally {
  child.kill('SIGTERM')
  await once(child, 'exit')
  backend.close()
  rmSync(temporary, { recursive: true, force: true })
}
