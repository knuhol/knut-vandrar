import { ImageResponse } from 'next/og'
import { hasLocale } from 'next-intl'

import { getHike } from '@/api/hikes'
import { serverConfig } from '@/config/server'
import { siteIdentity } from '@/config/site'
import { routing } from '@/i18n/routing'

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
  const data = Buffer.from(await response.arrayBuffer()).toString('base64')

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: `url(data:${type};base64,${data})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />,
    {
      ...siteIdentity.sharingImage,
      headers: { 'Cache-Control': 'public, max-age=300' },
    },
  )
}
