import 'server-only'

import { cache } from 'react'

import { client } from './client'

import type { Locale } from '@/i18n/routing'
import { collectionPageSize } from '@/hiking/pagination'

export const getHikes = cache(async (locale: Locale, offset = 0) => {
  const response = await client['/api/hikes'].get({
    query: { locale, limit: collectionPageSize, offset },
  })
  if (!response.ok) {
    throw new Error('Could not load hikes')
  }
  return response.json()
})

export const getHike = cache(async (locale: Locale, slug: string) => {
  const response = await client['/api/hikes/{locale}/{slug}'].get({ params: { locale, slug } })

  if (response.status === 404) {
    return undefined
  }
  if (!response.ok) {
    throw new Error('Could not load hike')
  }

  return response.json()
})

export async function getHikeDiscovery(offset = 0, limit = 100) {
  const response = await client['/api/discovery/hikes'].get({ query: { offset, limit } })
  if (!response.ok) {
    throw new Error('Could not load hike URLs')
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
