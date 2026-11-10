import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { IconArrowLeft as ArrowLeft } from '@tabler/icons-react'

import { HikeFacts } from './components/HikeFacts'

import { HikeStats } from '@/app/[locale]/components/HikeStats'
import { HikeStatus } from '@/app/[locale]/components/HikeStatus'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'
import { Markdown } from '@/components/Markdown'
import { imageUrl } from '@/lib/images'
import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { Footer, Header } from '@/components/Shell'
import { hikePath, routing } from '@/i18n/routing'
import { getHike, getHikeAlternative } from '@/lib/hikes'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const hike = await getHike(locale, slug)
  return { title: hike?.translation.title, description: hike?.translation.summary_markdown }
}

export default async function HikePage({ params }: Props) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const hike = await getHike(locale, slug)
  if (!hike) notFound()
  if (slug !== hike.translation.slug) permanentRedirect(hikePath(locale, hike.translation.slug))
  const t = await getTranslations('Site')
  const alternatives = await Promise.all(
    routing.locales.map(async (language) => {
      const alternative = language === locale ? hike : await getHikeAlternative(language, hike.id)
      return alternative
        ? { locale: language, href: hikePath(language, alternative.translation.slug) }
        : undefined
    }),
  )
  const links = alternatives.filter((item) => item !== undefined)
  return (
    <>
      <Header locale={locale} links={links} />
      <Container as="main" id="content" className="pt-6.25 pb-15">
        <nav
          className="mb-6.25 flex flex-wrap gap-3 text-status tablet:text-breadcrumb [&_a]:text-forest"
          aria-label={t('hikes')}
        >
          <Link href={`/${locale}#hikes`}>{t('hikes')}</Link>
          <span>/</span>
          <span>{hike.translation.title}</span>
        </nav>
        <div className="mb-6">
          <HikeStatus status={hike.status} />
          <Heading size="detail" className="my-3.5">
            {hike.translation.title}
          </Heading>
          {hike.translation.tagline && (
            <p className="text-tagline-mobile text-forest italic tablet:text-tagline">
              {hike.translation.tagline}
            </p>
          )}
        </div>
        {hike.cover_image_url && (
          <div className="relative h-(--detail-cover-height) overflow-hidden rounded-menu tablet:rounded-cover">
            <Image
              src={imageUrl(hike.cover_image_url)}
              alt={hike.translation.title}
              fill
              className="object-cover"
              priority
              unoptimized
              sizes="100vw"
            />
          </div>
        )}
        <div className="max-w-240 pt-7.5">
          <Markdown className="max-w-205 text-card">{hike.translation.summary_markdown}</Markdown>
          <HikeStats hike={hike} variant="detail" />
        </div>
        <div className="my-7.5 grid grid-cols-1 gap-6.25 tablet:my-11.25 tablet:grid-cols-[minmax(0,1fr)_var(--facts-width-tablet)] tablet:gap-7.5 desktop:grid-cols-[minmax(0,1fr)_var(--facts-width-desktop)] desktop:gap-16.25">
          <article>
            <Heading as="h2" className="mb-(--prose-heading-after)">
              {t('about')}
            </Heading>
            {hike.translation.description_markdown && (
              <Markdown>{hike.translation.description_markdown}</Markdown>
            )}
          </article>
          <HikeFacts hike={hike} locale={locale} />
        </div>
        <InfoCards cards={hike.cards} />
        <Link
          className="mt-10 inline-flex items-center gap-2.5 font-semibold text-forest"
          href={`/${locale}#hikes`}
        >
          <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
          {t('back')}
        </Link>
      </Container>
      <Footer locale={locale} />
    </>
  )
}
