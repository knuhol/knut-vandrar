import 'server-only'

import { createClient, type NormalizeOAS } from 'fets'

import { serverConfig } from '@/config/server'
import type { openapi } from '@/generated/openapi'
import type { Locale } from '@/i18n/routing'

const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: serverConfig.apiBaseUrl,
  globalParams: { next: { revalidate: 300, tags: ['hikes'] } },
})

export async function getHikes(locale: Locale) {
  const items = []
  let offset = 0
  for (;;) {
    const response = await client['/api/hikes'].get({ query: { locale, limit: 100, offset } })
    if (!response.ok) throw new Error('Could not load hikes')
    const page = await response.json()
    items.push(...page.items)
    offset += page.items.length
    if (offset >= page.total || page.items.length === 0) break
  }
  return items.sort((a, b) => {
    const startA = a.actual_start_at ?? a.planned_start_at
    const startB = b.actual_start_at ?? b.planned_start_at
    return (startB ? Date.parse(startB) : 0) - (startA ? Date.parse(startA) : 0)
  })
}

export async function getHike(locale: Locale, slug: string) {
  const response = await client['/api/hikes/{locale}/{slug}'].get({ params: { locale, slug } })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('Could not load hike')
  return response.json()
}

export async function getHikeAlternative(locale: Locale, id: string) {
  const response = await client['/api/hikes/{hike_id}'].get({
    params: { hike_id: id },
    query: { locale },
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('Could not load hike language')
  return response.json()
}
export type Hike = NonNullable<Awaited<ReturnType<typeof getHike>>>
export type HikeSummary = Awaited<ReturnType<typeof getHikes>>[number]
