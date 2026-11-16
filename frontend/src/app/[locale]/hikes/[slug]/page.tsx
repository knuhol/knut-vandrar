import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import { IconArrowLeft as ArrowLeft } from '@tabler/icons-react'

import { HikeGallery } from './components/HikeGallery/HikeGallery'

import { HikeNavigation, type HikeNavigationItem } from './components/HikeNavigation'
import { HikeSection } from './components/HikeSection/HikeSection'
import { HikeMasthead } from './components/HikeMasthead/HikeMasthead'
import { hasHikeJourney, HikeJourney } from './components/HikeJourney'
import { TrailFacts } from './components/TrailFacts'
import { TranslationNotice } from './components/TranslationNotice/TranslationNotice'

import { HikeStatus } from '@/app/[locale]/components/HikeStatus'
import { Container } from '@/components/Container'
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
  const hasJourney = hasHikeJourney(presentation.details)
  const isActive = hike.status === 'planned' || hike.status === 'ongoing'
  const resourceItem: HikeNavigationItem = {
    id: 'resources',
    label: t(isActive ? 'followHike' : 'hikeResources'),
  }
  const navigationItems: HikeNavigationItem[] = [
    ...(isActive && hike.cards.length > 0 ? [resourceItem] : []),
    { id: 'story', label: t('about') },
    ...(hasJourney ? [{ id: 'journey' as const, label: t('journey.title') }] : []),
    ...(hike.location ? [{ id: 'trail' as const, label: t('trailOrArea') }] : []),
    ...(!isActive && hike.cards.length > 0 ? [resourceItem] : []),
    ...(galleryPage.total > 0 ? [{ id: 'photos' as const, label: t('gallery.title') }] : []),
  ]

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
        <HikeMasthead hike={hike} endpoints={presentation.endpoints} />
        <div className="my-8 overflow-hidden rounded-lg bg-cream tablet:my-12">
          {hike.cover_image_url && (
            <div className="relative aspect-video max-h-100 w-full overflow-hidden">
              <Image
                src={imageUrl(hike.cover_image_url)}
                alt={hike.translation.title}
                fill
                className="object-cover"
                priority
                unoptimized
                sizes="100vw"
              />
              <div className="absolute top-3.75 left-3.75">
                <HikeStatus status={hike.status} />
              </div>
            </div>
          )}
          <div className="min-w-0 p-5 leading-relaxed text-forest tablet:p-8">
            {!hike.cover_image_url && (
              <div className="mb-4">
                <HikeStatus status={hike.status} />
              </div>
            )}
            <Markdown variant="lead">{hike.translation.summary_markdown}</Markdown>
          </div>
        </div>
        <div className="grid items-start gap-8 desktop:grid-cols-[var(--container-navigation)_minmax(0,1fr)] desktop:gap-10">
          <div className="desktop:sticky desktop:top-(--section-scroll-offset)">
            <HikeNavigation label={t('pageContents')} items={navigationItems} />
          </div>
          <div className="grid gap-12 tablet:gap-16">
            {isActive && hike.cards.length > 0 && (
              <HikeSection id="resources" title={t('followHike')} variant="contrast">
                <InfoCards cards={hike.cards} />
              </HikeSection>
            )}
            <HikeSection id="story" title={t('about')} as="article">
              <div>
                {locale !== 'en' && (
                  <div className="mb-6">
                    <TranslationNotice />
                  </div>
                )}
                {hike.translation.description_markdown && (
                  <Markdown>{hike.translation.description_markdown}</Markdown>
                )}
              </div>
            </HikeSection>
            {hasJourney && <HikeJourney details={presentation.details} status={hike.status} />}
            {hike.location && locationData && (
              <TrailFacts
                location={hike.location}
                locale={locale}
                tags={locationData.tags}
                ratings={locationData.ratings}
                details={locationData.details}
              />
            )}
            {!isActive && hike.cards.length > 0 && (
              <HikeSection id="resources" title={t('hikeResources')} variant="contrast">
                <InfoCards cards={hike.cards} />
              </HikeSection>
            )}
            <HikeGallery key={hike.id} hikeId={hike.id} locale={locale} initialPage={galleryPage} />
          </div>
        </div>
        <div className="mt-12 tablet:mt-16">
          <Link
            className="inline-flex items-center gap-2.5 font-semibold text-forest"
            href={{ pathname: '/', hash: 'hikes' }}
          >
            <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
            {t('back')}
          </Link>
        </div>
      </Container>
    </div>
  )
}
