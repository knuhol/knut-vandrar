import { NextResponse } from 'next/server'

import { boundedBody } from '@/admin/body'
import { adminConfig } from '@/admin/config'
import { hasSession, validOrigin } from '@/admin/security'
import { serverConfig } from '@/config/server'
import { openapi } from '@/generated/openapi'

export const runtime = 'nodejs'
const methods = new Set(['get', 'post', 'put', 'delete', 'patch'])

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  }
  if (request.method !== 'GET' && !validOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const segments = (await context.params).path
  if (segments.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
    return new Response(null, { status: 400 })
  }
  const pathname = `/api/${segments.join('/')}`
  const method = request.method.toLowerCase()
  const permitted = Object.entries(openapi.paths).some(([template, operations]) => {
    const pattern = '^' + template.replace(/\{[^}]+\}/g, '[a-zA-Z0-9_-]+') + '$'
    return new RegExp(pattern).test(pathname) && methods.has(method) && method in operations
  })
  if (!permitted || !adminConfig.apiToken) {
    return new Response(null, { status: 404 })
  }
  const headers = new Headers({ Authorization: `Bearer ${adminConfig.apiToken}` })
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('Content-Type', contentType)
  }
  let body: Uint8Array | undefined
  if (request.method !== 'GET') {
    try {
      body = await boundedBody(request, 5 * 1024 * 1024)
    } catch {
      return NextResponse.json({ error: 'Request too large (maximum 5 MiB)' }, { status: 413 })
    }
  }
  try {
    const response = await fetch(
      `${serverConfig.apiBaseUrl}${pathname}${new URL(request.url).search}`,
      {
        method: request.method,
        headers,
        cache: 'no-store',
        redirect: 'manual',
        body: body as BodyInit | undefined,
        signal: AbortSignal.timeout(30_000),
      },
    )
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'The API is unavailable. Please try again.' },
      { status: 502 },
    )
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const DELETE = forward
export const PATCH = forward
