import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'

import { Hero } from '@/app/[locale]/components/Hero/Hero'
import { HikeCollection } from '@/app/[locale]/components/HikeCollection'
import { routing } from '@/i18n/routing'
import { getHikes } from '@/api/hikes'
import { StructuredData } from '@/components/StructuredData'
import { collectionData } from '@/seo/structuredData'
import { pageMetadata } from '@/seo/metadata'
import { homeLanguages, homePath, absoluteUrl } from '@/seo/urls'
import { collectionOffset, collectionPageSize } from '@/hiking/pagination'
import type { Locale } from '@/i18n/routing'

type Query = { offset?: string | string[] }
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }

async function collection(locale: Locale, query: Query) {
  const offset = collectionOffset(query.offset)
  if (query.offset !== undefined && (offset === 0 || query.offset !== String(offset))) {
    permanentRedirect(homePath(locale, offset))
  }
  const page = await getHikes(locale, offset)
  if (offset > 0 && page.items.length === 0) {
    notFound()
  }
  return page
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    return {}
  }

  const t = await getTranslations({ locale, namespace: 'Site' })
  const page = await collection(locale, await searchParams)

  return pageMetadata({
    locale,
    title:
      page.offset === 0
        ? t('homeMetadataTitle')
        : t('collectionPageTitle', { page: page.offset / collectionPageSize + 1 }),
    description: t('metadataDescription'),
    path: homePath(locale, page.offset),
    languages: page.offset === 0 ? { ...homeLanguages(), 'x-default': absoluteUrl('/') } : {},
    imageAlt: t('sharingImageAlt'),
  })
}

export default async function Home({ params, searchParams }: Props) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const hikesPage = await collection(locale, await searchParams)
  const t = await getTranslations({ locale, namespace: 'Site' })

  return (
    <>
      <StructuredData data={collectionData(locale, hikesPage, t('collection'))} />
      <Hero />
      <HikeCollection page={hikesPage} />
    </>
  )
}
