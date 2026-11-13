import 'server-only'

import { createClient, type NormalizeOAS } from 'fets'

import { serverConfig } from '@/config/server'
import type { openapi } from '@/generated/openapi'
import type { Locale } from '@/i18n/routing'

const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: serverConfig.apiBaseUrl,
  globalParams: {
    cache: 'no-store',
  },
})

const pageSize = 6

export async function getHikes(locale: Locale, offset = 0) {
  const response = await client['/api/hikes'].get({ query: { locale, limit: pageSize, offset } })
  if (!response.ok) {
    throw new Error('Could not load hikes')
  }
  return response.json()
}

export async function getHike(locale: Locale, slug: string) {
  const response = await client['/api/hikes/{locale}/{slug}'].get({ params: { locale, slug } })

  if (response.status === 404) {
    return undefined
  }
  if (!response.ok) {
    throw new Error('Could not load hike')
  }

  return response.json()
}

export async function getHikeAlternative(locale: Locale, id: string) {
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

export type Hike = NonNullable<Awaited<ReturnType<typeof getHike>>>
export type HikesPage = Awaited<ReturnType<typeof getHikes>>
export type HikeSummary = HikesPage['items'][number]

export async function getPhotos(hikeId: string, locale: Locale, offset = 0) {
  const response = await client['/api/hikes/{hike_id}/photos'].get({
    params: { hike_id: hikeId },
    query: { locale, limit: 24, offset },
  })
  if (!response.ok) {
    throw new Error('Could not load gallery')
  }
  return response.json()
}
