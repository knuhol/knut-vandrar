import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Hero } from '@/app/[locale]/components/Hero/Hero'
import { HikeCollection } from '@/app/[locale]/components/HikeCollection'
import { routing } from '@/i18n/routing'
import { getHikes } from '@/api/hikes'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    return {}
  }

  const t = await getTranslations({ locale, namespace: 'Site' })

  return { title: t('collection'), description: t('intro') }
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ offset?: string | string[] }>
}) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const query = await searchParams
  const requestedOffset = typeof query.offset === 'string' ? Number(query.offset) : 0
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
  const hikesPage = await getHikes(locale, offset)

  return (
    <>
      <Hero />
      <HikeCollection page={hikesPage} />
    </>
  )
}
