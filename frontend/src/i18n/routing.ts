import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['sv', 'en', 'cs'],
  defaultLocale: 'sv',
  localePrefix: 'always',
  // Slugs and availability come from stored translations, not URL substitution.
  alternateLinks: false,
  pathnames: {
    '/': '/',
    '/privacyPolicy': { sv: '/integritetspolicy', en: '/privacy-policy', cs: '/ochrana-soukromi' },
    '/translationNotes': '/poznamky-k-prekladum',
    '/about': { sv: '/om-mig', en: '/about', cs: '/o-mne' },
    '/hikes/[slug]': { sv: '/vandringar/[slug]', en: '/hikes/[slug]', cs: '/hiky/[slug]' },
  },
})

export type Locale = (typeof routing.locales)[number]
