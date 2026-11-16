import { getTranslations } from 'next-intl/server'

import { getPageDiscovery } from '@/api/pages'
import { staticPages } from '@/content/staticPages'
import { getPathname } from '@/i18n/navigation'
import { siteIdentity } from '@/config/site'
import { absoluteUrl, homePath, isIndexable } from '@/seo/urls'
import { routing } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isIndexable) {
    return new Response(null, { status: 404 })
  }
  const t = await getTranslations({ locale: 'en', namespace: 'Site' })
  const collections = await Promise.all(
    routing.locales.map(async (locale) => {
      const localized = await getTranslations({ locale, namespace: 'Site' })
      return `- [${localized('languages.' + locale)}](${absoluteUrl(homePath(locale))}): ${localized('metadataDescription')}`
    }),
  )
  const pages = await getPageDiscovery()
  const body = [
    `# ${siteIdentity.name}`,
    '',
    `> ${t('metadataDescription')}`,
    '',
    '## Hiking stories',
    '',
    ...collections,
    '',
    `- [Sitemap](${absoluteUrl('/sitemap.xml')}): Canonical pages and available translations.`,
    '',
    '## Pages',
    '',
    ...pages
      .filter((page) => page.indexable)
      .map(
        (page) =>
          `- [${page.page_key} (${page.locale})](${absoluteUrl(getPathname({ locale: page.locale, href: staticPages[page.page_key].href }))})`,
      ),
    '',
    '## Author profiles',
    '',
    ...Object.entries(siteIdentity.profiles).map(
      ([profile, url]) => `- [${t(`social.${profile}`)}](${url})`,
    ),
    '',
  ].join('\n')
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  })
}
