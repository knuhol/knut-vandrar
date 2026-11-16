import { siteIdentity } from '@/config/site'
import { absoluteUrl, homePath, hikePath } from '@/seo/urls'
import type { Hike, HikesPage } from '@/api/hikes'
import type { Locale } from '@/i18n/routing'
import { plainText } from '@/seo/text'

const websiteId = `${absoluteUrl('/')}#website`
const authorId = `${absoluteUrl('/')}#author`

export function identityData(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: absoluteUrl('/'),
        name: siteIdentity.name,
        alternateName: siteIdentity.alternateName,
        inLanguage: ['sv', 'en', 'cs'],
        publisher: { '@id': authorId },
      },
      {
        '@type': 'Person',
        '@id': authorId,
        name: siteIdentity.author,
        url: absoluteUrl(homePath(locale)),
        image: absoluteUrl('/knut.png'),
        sameAs: Object.values(siteIdentity.profiles),
      },
    ],
  }
}

export function collectionData(locale: Locale, page: HikesPage, title: string) {
  const url = absoluteUrl(homePath(locale, page.offset))
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: title,
    inLanguage: locale,
    isPartOf: { '@id': websiteId },
    author: { '@id': authorId },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: page.items.map((hike, index) => ({
        '@type': 'ListItem',
        position: page.offset + index + 1,
        name: hike.translation.title,
        url: absoluteUrl(hikePath(locale, hike.translation.slug)),
      })),
    },
  }
}

export function hikeData(locale: Locale, hike: Hike, collection: string, image?: string) {
  const url = absoluteUrl(hikePath(locale, hike.translation.slug))
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        url,
        headline: hike.translation.title,
        description: plainText(hike.translation.summary_markdown),
        inLanguage: locale,
        author: { '@id': authorId },
        publisher: { '@id': authorId },
        isPartOf: { '@id': websiteId },
        mainEntityOfPage: url,
        ...(image ? { image: [image] } : {}),
        ...(hike.location ? { about: { '@type': 'Place', name: hike.location.name } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: collection,
            item: absoluteUrl(homePath(locale)),
          },
          { '@type': 'ListItem', position: 2, name: hike.translation.title, item: url },
        ],
      },
    ],
  }
}
