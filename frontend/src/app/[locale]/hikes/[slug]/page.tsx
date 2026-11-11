import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import { IconArrowLeft as ArrowLeft } from '@tabler/icons-react'

import { HikeFacts } from './components/HikeFacts'

import { HikeStats } from '@/app/[locale]/components/HikeStats'
import { HikeStatus } from '@/app/[locale]/components/HikeStatus'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'
import { Markdown } from '@/components/Markdown/Markdown'
import { imageUrl } from '@/api/images'
import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { getPathname, Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getHike } from '@/api/hikes'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params

  if (!hasLocale(routing.locales, locale)) {
    return {}
  }

  const hike = await getHike(locale, slug)

  return { title: hike?.translation.title, description: hike?.translation.summary_markdown }
}

export default async function HikePage({ params }: Props) {
  const { locale, slug } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const hike = await getHike(locale, slug)

  if (!hike) {
    notFound()
  }
  if (slug !== hike.translation.slug) {
    permanentRedirect(
      getPathname({
        locale,
        href: {
          pathname: '/hikes/[slug]',
          params: { slug: hike.translation.slug },
        },
      }),
    )
  }

  const t = await getTranslations('Site')

  return (
    <div className="pt-6.25 pb-15">
      <Container>
        <nav
          className="mb-6.25 flex flex-wrap gap-3 text-sm [&_a]:text-forest"
          aria-label={t('hikes')}
        >
          <Link href={{ pathname: '/', hash: 'hikes' }}>{t('hikes')}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{hike.translation.title}</span>
        </nav>
        <div className="mb-6">
          <HikeStatus status={hike.status} />
          <div className="my-3.5">
            <Heading>{hike.translation.title}</Heading>
          </div>
          {hike.translation.tagline && (
            <p className="text-xl text-forest italic">{hike.translation.tagline}</p>
          )}
          <HikeStats
            hike={hike}
            fontSize="lg"
            className="my-2 gap-x-5 leading-tight text-forest tablet:text-xl [&_span]:gap-1.5"
          />
        </div>
        {hike.cover_image_url && (
          <div className="relative aspect-video max-h-90 w-full overflow-hidden rounded-lg">
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
        <div className="max-w-reading pt-7.5 leading-relaxed text-forest tablet:pt-10">
          <Markdown variant="lead">{hike.translation.summary_markdown}</Markdown>
        </div>
        <div className="my-7.5 grid grid-cols-1 items-start gap-8 tablet:my-10 desktop:grid-cols-3 desktop:gap-12">
          <article className="min-w-0 max-w-reading desktop:col-span-2">
            <div className="mb-6">
              <Heading as="h2">{t('about')}</Heading>
            </div>
            {hike.translation.description_markdown && (
              <Markdown>{hike.translation.description_markdown}</Markdown>
            )}
          </article>
          <div className="order-first grid min-w-0 gap-4 desktop:order-none">
            <HikeFacts hike={hike} locale={locale} />
            <InfoCards cards={hike.cards} />
          </div>
        </div>
        <Link
          className="inline-flex items-center gap-2.5 font-semibold text-forest"
          href={{ pathname: '/', hash: 'hikes' }}
        >
          <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
          {t('back')}
        </Link>
      </Container>
    </div>
  )
}
