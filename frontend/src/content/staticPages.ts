import type { openapi } from '@/generated/openapi'

// Page identifiers are checked against FastAPI's generated schema.
export type PageKey = (typeof openapi.components.schemas.PageKey.enum)[number]
export const PageKey = {
  About: 'about',
  PrivacyPolicy: 'privacy-policy',
  CzechTranslationNotes: 'czech-translation-notes',
} as const satisfies Record<string, PageKey>

export const staticPages = {
  [PageKey.About]: { href: '/about' },
  [PageKey.PrivacyPolicy]: { href: '/privacyPolicy' },
  [PageKey.CzechTranslationNotes]: { href: '/translationNotes' },
} as const satisfies Record<PageKey, { href: '/about' | '/translationNotes' | '/privacyPolicy' }>
