import type { Metadata } from 'next'

import { siteIdentity } from '@/config/site'
import { absoluteUrl, homePath, isIndexable } from '@/seo/urls'
import type { Locale } from '@/i18n/routing'

const socialLocales = { sv: 'sv_SE', en: 'en_GB', cs: 'cs_CZ' } as const

export function pageMetadata({
  locale,
  title,
  description,
  path,
  languages,
  image,
  imageAlt,
  article = false,
}: {
  locale: Locale
  title: string
  description: string
  path: string
  languages: Record<string, string>
  image?: string
  imageAlt: string
  article?: boolean
}): Metadata {
  const url = absoluteUrl(path)
  const socialImage = image
    ? { url: image, alt: imageAlt }
    : {
        url: absoluteUrl(`/brand/sharing/${locale}.png`),
        alt: imageAlt,
        ...siteIdentity.sharingImage,
      }
  const fullTitle = `${title} · ${siteIdentity.name}`

  return {
    title: { absolute: fullTitle },
    description,
    authors: [{ name: siteIdentity.author, url: absoluteUrl(homePath(locale)) }],
    creator: siteIdentity.author,
    publisher: siteIdentity.name,
    alternates: { canonical: url, languages },
    robots: isIndexable
      ? { index: true, follow: true, 'max-image-preview': 'large' }
      : { index: false, follow: false },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteIdentity.name,
      locale: socialLocales[locale],
      alternateLocale: Object.keys(languages)
        .filter((language) => language !== locale && language in socialLocales)
        .map((language) => socialLocales[language as Locale]),
      images: [socialImage],
      ...(article
        ? { type: 'article', authors: [absoluteUrl(homePath(locale))] }
        : { type: 'website' }),
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [socialImage] },
  }
}
