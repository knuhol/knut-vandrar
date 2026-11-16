import 'server-only'

import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'

import { staticPages, type PageKey } from './staticPages'

import { getPage, type PublicPage } from '@/api/pages'
import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { pageMetadata } from '@/seo/metadata'
import { absoluteUrl } from '@/seo/urls'

export type PageProps = { params: Promise<{ locale: string }> }

export async function resolvePage(key: PageKey, params: PageProps['params']) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  const page = await getPage(key, locale)
  if (!page) {
    notFound()
  }
  return { page, locale }
}

export function staticPageMetadata(page: PublicPage) {
  const { content, locale } = page
  const href = staticPages[page.page_key].href
  return pageMetadata({
    locale,
    indexable: page.indexable,
    title: content.title,
    description: content.introduction,
    path: getPathname({ locale, href }),
    languages: Object.fromEntries(
      page.available_locales.map((language) => [
        language,
        absoluteUrl(getPathname({ locale: language, href })),
      ]),
    ),
    imageAlt: content.type === 'about' ? content.portrait_alt : content.title,
    ...(content.type === 'about' ? { image: absoluteUrl('/knut.webp') } : {}),
  })
}
