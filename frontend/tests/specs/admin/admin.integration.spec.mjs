/** @jest-environment node */

import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { DatabaseSync } from 'node:sqlite'

test('admin authentication, proxy security, uploads, and session lifecycle', async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'knut-admin-test-'))
  const password = randomBytes(24).toString('hex')
  const salt = randomBytes(32).toString('hex')
  const token = randomBytes(32).toString('hex')
  let calls = 0
  let bodyBytes = 0
  const backend = createServer((request, response) => {
    expect(request.headers.authorization).toBe(`Bearer ${token}`)
    calls++
    bodyBytes = 0
    request.on('data', (chunk) => {
      bodyBytes += chunk.length
    })
    request.on('end', () => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ items: [], total: 0 }))
    })
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
  const resolveModule = createRequire(path.join(process.cwd(), 'package.json'))
  const child = spawn(
    process.execPath,
    [
      resolveModule.resolve('next/dist/bin/next'),
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
        NODE_ENV: 'development',
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
    // Admin test server must start
    expect(ready).toBe(true)
    const anonymous = await call('/api/admin/auth')
    expect(await anonymous.json()).toEqual({ authenticated: false })
    expect(anonymous.headers.get('cache-control')).toBe('no-store')
    expect((await call('/api/admin/backend/hikes')).status).toBe(401)
    expect(
      (await call('/api/admin/backend/hikes', 'GET', undefined, 'admin_session=malformed')).status,
    ).toBe(401)
    expect(
      (await call('/api/admin/auth', 'POST', { password }, undefined, 'https://evil.example'))
        .status,
    ).toBe(403)
    expect((await call('/api/admin/auth', 'POST', { password: 'wrong' })).status).toBe(401)
    const login = await call('/api/admin/auth', 'POST', { password })
    expect(login.status).toBe(200)
    const cookieHeader = login.headers.get('set-cookie')
    expect(cookieHeader).toMatch(/HttpOnly/i)
    expect(cookieHeader).toMatch(/SameSite=strict/i)
    const cookie = cookieHeader.split(';')[0]
    expect(await (await call('/api/admin/auth', 'GET', undefined, cookie)).json()).toEqual({
      authenticated: true,
    })
    // A cross-origin logout must not revoke the session
    expect(
      (await call('/api/admin/auth', 'DELETE', undefined, cookie, 'https://evil.example')).status,
    ).toBe(403)
    expect((await call('/api/admin/backend/hikes', 'GET', undefined, cookie)).status).toBe(200)
    expect(calls).toBe(1)
    const uploadHeaders = {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/octet-stream',
    }
    const photoUpload = await fetch(`${origin}/api/admin/backend/hikes/test-hike/photos`, {
      method: 'POST',
      headers: uploadHeaders,
      body: new Uint8Array(6_000_000),
    })
    // Gallery uploads accept photos larger than 5 MiB
    expect(photoUpload.status).toBe(200)
    expect(bodyBytes).toBe(6_000_000)
    const coverUpload = await fetch(`${origin}/api/admin/backend/hikes/test-hike/cover-image`, {
      method: 'PUT',
      headers: uploadHeaders,
      body: new Uint8Array(6_000_000),
    })
    // Cover images accept photos larger than 5 MiB
    expect(coverUpload.status).toBe(200)
    expect(bodyBytes).toBe(6_000_000)
    const callsBeforeOversized = calls
    const logoUpload = await fetch(`${origin}/api/admin/backend/locations/test-location/logo`, {
      method: 'PUT',
      headers: uploadHeaders,
      body: new Uint8Array(6_000_000),
    })
    // Logos retain their existing size limit
    expect(logoUpload.status).toBe(413)
    const oversizedCover = await fetch(`${origin}/api/admin/backend/hikes/test-hike/cover-image`, {
      method: 'PUT',
      headers: uploadHeaders,
      body: new Uint8Array(25_000_001),
    })
    // Cover uploads enforce the 25 MB limit
    expect(oversizedCover.status).toBe(413)
    const oversizedPhoto = await fetch(`${origin}/api/admin/backend/hikes/test-hike/photos`, {
      method: 'POST',
      headers: uploadHeaders,
      body: new Uint8Array(25_000_001),
    })
    // Gallery uploads enforce the 25 MB limit
    expect(oversizedPhoto.status).toBe(413)
    // Rejected uploads must not reach the backend
    expect(calls).toBe(callsBeforeOversized)
    expect(
      (await call('/api/admin/backend/hikes', 'POST', {}, cookie, 'https://evil.example')).status,
    ).toBe(403)
    expect((await call('/api/admin/backend/not-an-api', 'GET', undefined, cookie)).status).toBe(404)
    const page = await call('/admin', 'GET', undefined, cookie)
    expect(page.status).toBe(200)
    const html = await page.text()
    // Permanent token must never appear in HTML
    expect(html.includes(token)).toBe(false)
    // Password must never appear in HTML
    expect(html.includes(password)).toBe(false)
    // Admin must render
    expect(html).toContain('Knut vandrar')
    expect((await call('/api/admin/auth', 'DELETE', undefined, cookie)).status).toBe(200)
    expect((await call('/api/admin/backend/hikes', 'GET', undefined, cookie)).status).toBe(401)
    const second = await call('/api/admin/auth', 'POST', { password })
    const secondCookie = second.headers.get('set-cookie').split(';')[0]
    const database = new DatabaseSync(path.join(temporary, 'sessions.sqlite'))
    database.exec('UPDATE sessions SET expires = 0')
    expect((await call('/api/admin/backend/hikes', 'GET', undefined, secondCookie)).status).toBe(
      401,
    )
    database.close()
    for (let attempt = 0; attempt < 7; attempt++) {
      await call('/api/admin/auth', 'POST', { password: 'wrong' })
    }
    const rateLimited = await call('/api/admin/auth', 'POST', { password })
    expect(rateLimited.status).toBe(429)
    expect(rateLimited.headers.get('retry-after')).toBe('900')
  } catch (error) {
    throw new Error(
      `Admin integration failed: ${error.message}. Captured ${output.length} server-log characters (not printed).`,
      { cause: error },
    )
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit')
      child.kill('SIGTERM')
      await stopped
    }
    await new Promise((resolve, reject) => {
      backend.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
      backend.closeAllConnections()
    })
    rmSync(temporary, { recursive: true, force: true })
  }
}, 180_000)
