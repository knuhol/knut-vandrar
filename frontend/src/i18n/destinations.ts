import 'server-only'

import type { getPathname } from './navigation'
import type { routing, Locale } from './routing'

import { getHike, getHikeAlternative } from '@/api/hikes'

type Destination = Parameters<typeof getPathname>[0]['href']
type Route = keyof typeof routing.pathnames
type ResolveDestination = (
  locale: Locale,
  target: Locale,
  params: Record<string, string | string[]>,
) => Promise<Destination | undefined>

// Every route must explicitly define its language-switch behavior. Content routes
// resolve translated slugs here, keeping the shared switcher independent of content types.
const destinations = {
  '/': () => Promise.resolve('/' as const),
  '/hikes/[slug]': async (locale, target, params) => {
    if (typeof params.slug !== 'string' || !params.slug) {
      return undefined
    }

    const hike = await getHike(locale, params.slug)
    const alternative = hike && (await getHikeAlternative(target, hike.id))

    return alternative
      ? { pathname: '/hikes/[slug]', params: { slug: alternative.translation.slug } }
      : undefined
  },
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
