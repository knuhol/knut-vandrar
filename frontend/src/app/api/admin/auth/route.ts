import { NextResponse } from 'next/server'

import { boundedBody } from '@/admin/body'
import { adminConfig } from '@/admin/config'
import {
  allowLogin,
  createSession,
  hasSession,
  revokeSession,
  sessionCookie,
  validOrigin,
  verifyPassword,
} from '@/admin/security'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(
    { authenticated: await hasSession() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  if (!adminConfig.passwordHash || !adminConfig.apiToken) {
    return NextResponse.json({ error: 'Admin credentials are not configured' }, { status: 503 })
  }
  if (!allowLogin()) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      { status: 429, headers: { 'Retry-After': '900' } },
    )
  }
  let raw: string
  try {
    raw = new TextDecoder().decode(await boundedBody(request, 4096))
  } catch {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 })
  }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('password' in body) ||
    typeof body.password !== 'string' ||
    !(await verifyPassword(body.password))
  ) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }
  const response = NextResponse.json(
    { authenticated: true },
    { headers: { 'Cache-Control': 'no-store' } },
  )
  response.cookies.set(adminConfig.cookie, createSession(), sessionCookie())
  return response
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  await revokeSession()
  const response = NextResponse.json({ authenticated: false })
  response.cookies.set(adminConfig.cookie, '', { ...sessionCookie(), maxAge: 0 })
  return response
}
