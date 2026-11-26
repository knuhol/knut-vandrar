import 'server-only'

import type { getPathname } from './navigation'
import type { routing, Locale } from './routing'

import { PageKey, staticPages } from '@/content/staticPages'
import { getPage } from '@/api/pages'

import { getHike } from '@/api/hikes'

type Destination = Parameters<typeof getPathname>[0]['href']
type Route = keyof typeof routing.pathnames
type ResolveDestination = (
  locale: Locale,
  target: Locale,
  params: Record<string, string | string[]>,
) => Promise<Destination | undefined>

function hikeDestination(pathname: '/hikes/[slug]'): ResolveDestination {
  return async (locale, target, params) => {
    if (typeof params.slug !== 'string' || !params.slug) {
      return undefined
    }
    const hike = await getHike(locale, params.slug)
    const alternative = hike?.available_translations.find((item) => item.locale === target)
    return alternative ? { pathname, params: { slug: alternative.slug } } : undefined
  }
}

// Every route must explicitly define its language-switch behavior. Content routes
// resolve translated slugs here, keeping the shared switcher independent of content types.
const destinations = {
  '/': () => Promise.resolve('/' as const),
  '/translationNotes': async (_locale, target) =>
    (await getPage(PageKey.CzechTranslationNotes, target))
      ? staticPages[PageKey.CzechTranslationNotes].href
      : '/',
  '/privacyPolicy': async (_locale, target) =>
    (await getPage(PageKey.PrivacyPolicy, target)) ? staticPages[PageKey.PrivacyPolicy].href : '/',
  '/about': async (_locale, target) =>
    (await getPage(PageKey.About, target)) ? staticPages[PageKey.About].href : '/',
  '/hikes/[slug]': hikeDestination('/hikes/[slug]'),
} satisfies Record<Route, ResolveDestination>

export async function resolveLanguageDestination(
  pathname: string,
  locale: Locale,
  target: Locale,
  params: Record<string, string | string[]>,
) {
  if (!Object.hasOwn(destinations, pathname)) {
    return undefined
  }

  const resolve: ResolveDestination = destinations[pathname as Route]

  return resolve(locale, target, params)
}
