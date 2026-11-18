import { hasLocale } from 'next-intl'

import { getHike } from '@/api/hikes'
import { serverConfig } from '@/config/server'
import { routing } from '@/i18n/routing'
import { sharingImage } from '@/seo/sharingImage'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) {
    return new Response(null, { status: 404 })
  }
  const hike = await getHike(locale, slug)
  if (!hike?.cover_image_url) {
    return new Response(null, { status: 404 })
  }

  // Media comes only from our configured backend, never a caller-supplied host.
  const path = new URL(hike.cover_image_url, 'http://internal').pathname
  const response = await fetch(`${serverConfig.apiBaseUrl}${path}`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    return new Response(null, { status: 502 })
  }
  const type = response.headers.get('content-type')?.split(';')[0]
  if (!type?.startsWith('image/')) {
    return new Response(null, { status: 502 })
  }
  try {
    const output = await sharingImage(new Uint8Array(await response.arrayBuffer()))
    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
