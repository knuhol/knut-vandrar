import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import { IconArrowLeft as ArrowLeft } from '@tabler/icons-react'

import { HikeGallery } from './components/HikeGallery/HikeGallery'

import { HikeFacts } from './components/HikeFacts'
import { TrailFacts } from './components/TrailFacts'
import { TranslationNotice } from './components/TranslationNotice/TranslationNotice'

import { HikeStatus } from '@/app/[locale]/components/HikeStatus'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'
import { Markdown } from '@/components/Markdown/Markdown'
import { imageUrl } from '@/api/images'
import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { getPathname, Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getHike, getPhotos } from '@/api/hikes'

import { hikePresentation, locationPresentation } from '@/hiking/presentation'

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
  const galleryPage = await getPhotos(hike.id, locale)
  const presentation = hikePresentation(hike)
  const locationData = hike.location && locationPresentation(hike.location)
  const isActive = hike.status === 'planned' || hike.status === 'ongoing'

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
        </div>
        <section className="mb-7.5 grid gap-4" aria-label={t('hikeFacts')}>
          <HikeFacts
            hike={hike}
            endpoints={presentation.endpoints}
            details={presentation.details}
          />
          {isActive && hike.cards.length > 0 && (
            <section>
              <div className="mb-4">
                <Heading as="h2" className="text-xl">
                  {t('followHike')}
                </Heading>
              </div>
              <InfoCards cards={hike.cards} />
            </section>
          )}
        </section>
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
            {locale !== 'en' && hike.translation.review_status !== 'manual' && (
              <div className="mb-6">
                <TranslationNotice />
              </div>
            )}
            {hike.translation.description_markdown && (
              <Markdown>{hike.translation.description_markdown}</Markdown>
            )}
          </article>
          {hike.location && locationData && (
            <TrailFacts
              location={hike.location}
              locale={locale}
              tags={locationData.tags}
              ratings={locationData.ratings}
              details={locationData.details}
            />
          )}
        </div>
        {!isActive && hike.cards.length > 0 && (
          <section className="mb-7.5">
            <div className="mb-4">
              <Heading as="h2" className="text-xl">
                {t('hikeResources')}
              </Heading>
            </div>
            <InfoCards cards={hike.cards} />
          </section>
        )}
        <HikeGallery key={hike.id} hikeId={hike.id} locale={locale} initialPage={galleryPage} />
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
