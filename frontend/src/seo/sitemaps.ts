import type { MetadataRoute } from 'next'

import { getHikeDiscovery } from '@/api/hikes'
import { absoluteUrl, homePath, homeLanguages, hikeLanguages } from '@/seo/urls'
import { routing } from '@/i18n/routing'

const hikesPerSitemap = 1000
const discoveryPageSize = 100

type SitemapSource = {
  count: () => Promise<number>
  entries: (page: number) => Promise<MetadataRoute.Sitemap>
}

// New public page types register their discovery here; route handlers stay generic.
const sources: Record<string, SitemapSource> = {
  pages: {
    count: () => Promise.resolve(1),
    entries: () =>
      Promise.resolve(
        routing.locales.map((locale) => ({
          url: absoluteUrl(homePath(locale)),
          alternates: { languages: { ...homeLanguages(), 'x-default': absoluteUrl('/') } },
        })),
      ),
  },
  hikes: {
    count: async () => Math.ceil((await getHikeDiscovery(0, 1)).total / hikesPerSitemap),
    entries: async (page) => {
      const entries: MetadataRoute.Sitemap = []
      const start = page * hikesPerSitemap
      for (let offset = start; offset < start + hikesPerSitemap; offset += discoveryPageSize) {
        const batch = await getHikeDiscovery(offset, discoveryPageSize)
        for (const hike of batch.items) {
          const languages = hikeLanguages(hike.translations)
          for (const url of Object.values(languages)) {
            entries.push({ url, alternates: { languages } })
          }
        }
        if (offset + batch.items.length >= batch.total || batch.items.length < discoveryPageSize) {
          break
        }
      }
      return entries
    },
  },
}

export function escapeXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ||
      character,
  )
}

export async function sitemapIndex() {
  const groups = await Promise.all(
    Object.entries(sources).map(async ([name, source]) => {
      const count = await source.count()
      return Array.from(
        { length: count },
        (_, page) =>
          `<sitemap><loc>${escapeXml(absoluteUrl(`/sitemaps/${name}-${String(page)}.xml`))}</loc></sitemap>`,
      ).join('')
    }),
  )
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${groups.join('')}</sitemapindex>`
}

export async function sitemapDocument(filename: string) {
  const match = /^([a-z]+)-(0|[1-9]\d*)\.xml$/.exec(filename)
  if (!match || !Object.hasOwn(sources, match[1]) || !Number.isSafeInteger(Number(match[2]))) {
    return undefined
  }
  const source = sources[match[1]]
  const page = Number(match[2])
  if (page >= (await source.count())) {
    return undefined
  }
  const entries = await source.entries(page)
  const urls = entries
    .map((entry) => {
      const alternates = Object.entries(entry.alternates?.languages || {})
        .map(
          ([language, url]) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(String(url))}"/>`,
        )
        .join('')
      return `<url><loc>${escapeXml(entry.url)}</loc>${alternates}</url>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`
}

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  })
}
