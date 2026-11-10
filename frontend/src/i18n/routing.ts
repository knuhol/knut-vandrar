import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['sv', 'en', 'cs'],
  defaultLocale: 'sv',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/hikes/[slug]': { sv: '/vandringar/[slug]', en: '/hikes/[slug]', cs: '/hiky/[slug]' },
  },
})
export type Locale = (typeof routing.locales)[number]

export function hikePath(locale: Locale, slug: string) {
  const section = { sv: 'vandringar', en: 'hikes', cs: 'hiky' }[locale]
  return `/${locale}/${section}/${encodeURIComponent(slug)}`
}
