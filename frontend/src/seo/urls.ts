import 'server-only'

import { serverConfig } from '@/config/server'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'

export const siteOrigin = serverConfig.siteOrigin
export const isIndexable = serverConfig.deploymentEnvironment === 'prod'

export function absoluteUrl(path: string) {
  return new URL(path, `${siteOrigin}/`).href
}

export function homePath(locale: Locale, offset = 0) {
  return getPathname({ locale, href: offset > 0 ? { pathname: '/', query: { offset } } : '/' })
}

export function hikePath(locale: Locale, slug: string) {
  return getPathname({ locale, href: { pathname: '/hikes/[slug]', params: { slug } } })
}

export function hikeSharingImage(locale: Locale, slug: string) {
  return absoluteUrl(`/brand/hikes/${locale}/${encodeURIComponent(slug)}`)
}

export function homeLanguages(offset = 0) {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(homePath(locale, offset))]),
  )
}

export function hikeLanguages(translations: readonly { locale: string; slug: string }[]) {
  return Object.fromEntries(
    translations
      .filter((item) => routing.locales.some((locale) => locale === item.locale))
      .map((item) => [item.locale, absoluteUrl(hikePath(item.locale as Locale, item.slug))]),
  )
}
