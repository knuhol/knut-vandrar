import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'

import { HomeCoverPrefetch } from '@/app/[locale]/components/HomeCoverPrefetch'
import { Hero } from '@/app/[locale]/components/Hero/Hero'
import { LanguageNotice } from '@/app/[locale]/components/LanguageNotice'
import { HikeCollection } from '@/app/[locale]/components/HikeCollection'
import { languageNoticeParameter, missingHikeTranslation } from '@/i18n/languageNotice'
import { routing } from '@/i18n/routing'
import { getHikes } from '@/api/hikes'
import { hikeCoverSources } from '@/api/images'
import { hikeCategories } from '@/hiking/categories'
import { StructuredData } from '@/components/StructuredData'
import { collectionData } from '@/seo/structuredData'
import { pageMetadata } from '@/seo/metadata'
import { homeLanguages, homePath, absoluteUrl } from '@/seo/urls'
import { collectionOffset, collectionPageSize } from '@/hiking/pagination'
import type { Locale } from '@/i18n/routing'

type Query = {
  offset?: string | string[]
  multiDayOffset?: string | string[]
  [languageNoticeParameter]?: string | string[]
}
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }

async function collection(locale: Locale, query: Query) {
  const offset = collectionOffset(query.offset)
  const multiDayOffset = collectionOffset(query.multiDayOffset)
  if (
    (query.offset !== undefined && (offset === 0 || query.offset !== String(offset))) ||
    (query.multiDayOffset !== undefined &&
      (multiDayOffset === 0 || query.multiDayOffset !== String(multiDayOffset)))
  ) {
    permanentRedirect(homePath(locale, offset, multiDayOffset))
  }
  const [longDistance, multiDay] = await Promise.all([
    getHikes(locale, offset, 'long_distance'),
    getHikes(locale, multiDayOffset, 'multi_day'),
  ])
  if (
    (offset > 0 && longDistance.items.length === 0) ||
    (multiDayOffset > 0 && multiDay.items.length === 0)
  ) {
    notFound()
  }
  return {
    pages: { long_distance: longDistance, multi_day: multiDay },
    offset,
    multiDayOffset,
    items: [...longDistance.items, ...multiDay.items],
    total: longDistance.total + multiDay.total,
  }
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
      page.offset === 0 && page.multiDayOffset === 0
        ? t('homeMetadataTitle')
        : t('collectionPageTitle', {
            page: Math.max(page.offset, page.multiDayOffset) / collectionPageSize + 1,
          }),
    description: t('metadataDescription'),
    path: homePath(locale, page.offset, page.multiDayOffset),
    languages:
      page.offset === 0 && page.multiDayOffset === 0
        ? { ...homeLanguages(), 'x-default': absoluteUrl('/') }
        : {},
    imageAlt: t('sharingImageAlt'),
  })
}

export default async function Home({ params, searchParams }: Props) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const query = await searchParams
  const hikesPage = await collection(locale, query)
  const t = await getTranslations({ locale, namespace: 'Site' })
  const covers = hikeCategories.flatMap(({ key }) => {
    const page = hikesPage.pages[key]
    return page.offset === 0
      ? page.items.slice(0, collectionPageSize).flatMap((hike) => hikeCoverSources(hike) ?? [])
      : []
  })

  return (
    <>
      <StructuredData
        data={collectionData(
          locale,
          {
            items: hikesPage.items,
            total: hikesPage.total,
            offset: 0,
            limit: collectionPageSize * 2,
          },
          t('collection'),
          homePath(locale, hikesPage.offset, hikesPage.multiDayOffset),
        )}
      />
      <HomeCoverPrefetch covers={covers} />
      {query[languageNoticeParameter] === missingHikeTranslation && <LanguageNotice />}
      <Hero />
      <HikeCollection pages={hikesPage.pages} />
    </>
  )
}
