import 'server-only'

import { cache } from 'react'

import { client } from './client'

import type { Locale } from '@/i18n/routing'
import type { PageKey } from '@/content/staticPages'

export const getPage = cache(async (key: PageKey, locale: Locale) => {
  const response = await client['/api/pages/{page_key}'].get({
    params: { page_key: key },
    query: { locale },
  })
  if (response.status === 404) {
    return undefined
  }
  if (!response.ok) {
    throw new Error('Could not load page')
  }
  return response.json()
})

export const getPageDiscovery = cache(async () => {
  const response = await client['/api/pages'].get()
  if (!response.ok) {
    throw new Error('Could not load page discovery')
  }
  return response.json()
})

export type PublicPage = NonNullable<Awaited<ReturnType<typeof getPage>>>
export type StandardPageContent = Extract<PublicPage['content'], { type: 'standard' }>
