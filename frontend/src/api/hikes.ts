import 'server-only'

import { createClient, type NormalizeOAS } from 'fets'

import { serverConfig } from '@/config/server'
import type { openapi } from '@/generated/openapi'
import type { Locale } from '@/i18n/routing'
import mockHikesJson from '@/mocks/hikes.json'

const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: serverConfig.apiBaseUrl,
  globalParams: {
    cache: 'no-store',
  },
})

const pageSize = 6
// JSON imports widen string literals; keep fixtures aligned with the API-derived type.
const mockHikes = mockHikesJson as Hike[]

export async function getHikes(locale: Locale, offset = 0) {
  const localizedMocks = mockHikes.filter((hike) => hike.translation.locale === locale)
  const mockItems = localizedMocks.slice(offset, offset + pageSize)
  const remaining = pageSize - mockItems.length
  const response = await client['/api/hikes'].get({
    query: {
      locale,
      limit: Math.max(1, remaining),
      offset: Math.max(0, offset - localizedMocks.length),
    },
  })

  if (!response.ok) {
    throw new Error('Could not load hikes')
  }

  const page = await response.json()

  return {
    ...page,
    items: [...mockItems, ...page.items.slice(0, remaining)],
    total: page.total + localizedMocks.length,
    limit: pageSize,
    offset,
  }
}

async function getApiHike(locale: Locale, slug: string) {
  const response = await client['/api/hikes/{locale}/{slug}'].get({ params: { locale, slug } })

  if (response.status === 404) {
    return undefined
  }
  if (!response.ok) {
    throw new Error('Could not load hike')
  }

  return response.json()
}

export async function getHike(locale: Locale, slug: string) {
  return (
    mockHikes.find(
      (hike) => hike.translation.locale === locale && hike.translation.slug === slug,
    ) ?? getApiHike(locale, slug)
  )
}

export async function getHikeAlternative(locale: Locale, id: string) {
  const mockHike = mockHikes.find((hike) => hike.translation.locale === locale && hike.id === id)

  if (mockHike) {
    return mockHike
  }

  const response = await client['/api/hikes/{hike_id}'].get({
    params: { hike_id: id },
    query: { locale },
  })

  if (response.status === 404) {
    return undefined
  }
  if (!response.ok) {
    throw new Error('Could not load hike language')
  }

  return response.json()
}
export type Hike = NonNullable<Awaited<ReturnType<typeof getApiHike>>>
export type HikesPage = Awaited<ReturnType<typeof getHikes>>
export type HikeSummary = HikesPage['items'][number]
