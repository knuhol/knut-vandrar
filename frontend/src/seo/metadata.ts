import type { Metadata } from 'next'

import { getPathname } from '@/i18n/navigation'
import { siteIdentity } from '@/config/site'
import { absoluteUrl, isIndexable } from '@/seo/urls'
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
  imageSize,
  article = false,
  indexable = true,
}: {
  locale: Locale
  title: string
  description: string
  path: string
  languages: Record<string, string>
  image?: string
  imageAlt: string
  imageSize?: { width: number; height: number }
  article?: boolean
  indexable?: boolean
}): Metadata {
  const url = absoluteUrl(path)
  const socialImage = image
    ? { url: image, alt: imageAlt, ...imageSize }
    : {
        url: absoluteUrl(`/brand/sharing/${locale}.png`),
        alt: imageAlt,
        ...siteIdentity.sharingImage,
      }
  const fullTitle = `${title} · ${siteIdentity.name}`
  const socialDescription =
    description.length > 125
      ? `${description
          .slice(0, 124)
          .replace(/\s+\S*$/, '')
          .trimEnd()}…`
      : description

  return {
    title: { absolute: fullTitle },
    description,
    authors: [
      { name: siteIdentity.author, url: absoluteUrl(getPathname({ locale, href: '/about' })) },
    ],
    creator: siteIdentity.author,
    publisher: siteIdentity.name,
    alternates: { canonical: url, languages },
    robots: isIndexable
      ? { index: indexable, follow: true, 'max-image-preview': 'large' }
      : { index: false, follow: false },
    openGraph: {
      title: fullTitle,
      description: socialDescription,
      url,
      siteName: siteIdentity.name,
      locale: socialLocales[locale],
      alternateLocale: Object.keys(languages)
        .filter((language) => language !== locale && language in socialLocales)
        .map((language) => socialLocales[language as Locale]),
      images: [socialImage],
      ...(article
        ? { type: 'article', authors: [absoluteUrl(getPathname({ locale, href: '/about' }))] }
        : { type: 'website' }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: socialDescription,
      images: [socialImage],
    },
  }
}
