import { NextResponse } from 'next/server'

import { boundedBody } from '@/admin/body'
import { previewConfig, previewDestination, previewHeaders, previewHost } from '@/preview/config'
import {
  allowPreviewLogin,
  previewSession,
  resetPreviewLoginAttempts,
  verifyPreviewPassword,
} from '@/preview/security'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!previewHost(request.headers.get('host'))) {
    return new NextResponse(null, { status: 404, headers: previewHeaders })
  }
  if (request.headers.get('origin') !== previewConfig.origin) {
    return new NextResponse(null, { status: 403, headers: previewHeaders })
  }
  let form: URLSearchParams
  try {
    form = new URLSearchParams(new TextDecoder().decode(await boundedBody(request, 4096)))
  } catch {
    return new NextResponse(null, { status: 400, headers: previewHeaders })
  }
  const next = previewDestination(form.get('next'))
  const gate = new URL('/preview', previewConfig.origin)
  gate.searchParams.set('next', next)
  let error: string | undefined
  if (!previewConfig.passwordHash) {
    error = 'unavailable'
  } else if (!allowPreviewLogin()) {
    error = 'limited'
  } else if (!(await verifyPreviewPassword(form.get('password') || ''))) {
    error = 'password'
  }
  if (error) {
    gate.searchParams.set('error', error)
    return NextResponse.redirect(gate, { status: 303, headers: previewHeaders })
  }
  resetPreviewLoginAttempts()
  const response = NextResponse.redirect(new URL(next, previewConfig.origin), {
    status: 303,
    headers: previewHeaders,
  })
  response.cookies.set(previewConfig.cookie, previewSession(), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: previewConfig.sessionSeconds,
  })
  return response
}
