import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Hero } from '@/app/[locale]/components/Hero'
import { HikeCollection } from '@/app/[locale]/components/HikeCollection'
import { Footer, Header } from '@/components/Shell'
import { routing } from '@/i18n/routing'
import { getHikes } from '@/lib/hikes'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Site' })
  return { title: t('collection'), description: t('intro') }
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const hikes = await getHikes(locale)
  return (
    <>
      <Header locale={locale} />
      <main id="content">
        <Hero />
        <HikeCollection hikes={hikes} locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  )
}
