import { hasLocale } from 'next-intl'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { resolveLanguageDestination } from '@/i18n/destinations'
import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

const routeParams = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const locale = query.get('locale')
  const target = query.get('target')
  const pathname = query.get('pathname')
  let params: Record<string, string | string[]>

  try {
    params = routeParams.parse(JSON.parse(query.get('params') || '{}'))
  } catch {
    return new NextResponse(null, { status: 400 })
  }

  if (!hasLocale(routing.locales, locale) || !hasLocale(routing.locales, target) || !pathname) {
    return new NextResponse(null, { status: 400 })
  }

  const destination = await resolveLanguageDestination(pathname, locale, target, params)

  if (!destination) {
    return new NextResponse(null, { status: 404 })
  }

  const response = new NextResponse(null, {
    status: 307,
    headers: {
      Location: getPathname({ locale: target, href: destination }),
      'Cache-Control': 'no-store',
    },
  })
  response.cookies.set('NEXT_LOCALE', target, { path: '/', maxAge: 31_536_000, sameSite: 'lax' })

  return response
}
