import type { Metadata } from 'next'
import { Suspense } from 'react'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'
import { IconArrowDown } from '@tabler/icons-react'

import { HikePagination } from './components/HikePagination'
import { DynamicHikeMap } from './components/DynamicHikeMap/DynamicHikeMap'
import { MapUnavailable } from './components/DynamicHikeMap/MapUnavailable'

import { HikeGallery } from './components/HikeGallery/HikeGallery'

import { HikeNavigation, type HikeNavigationItem } from './components/HikeNavigation'
import { HikeSection } from './components/HikeSection/HikeSection'
import { HikeMasthead } from './components/HikeMasthead/HikeMasthead'
import { HikeOverview } from './components/HikeOverview/HikeOverview'
import { HikeJourney, hasHikeJourney } from './components/HikeJourney'
import { TrailFooter } from './components/TrailFooter/TrailFooter'
import { TrailFacts } from './components/TrailFacts'
import { FootstepTrail } from './components/FootstepTrail'
import { TranslationNotice } from './components/TranslationNotice/TranslationNotice'

import { HikeFacts } from './components/HikeFacts'
import { serverConfig } from '@/config/server'
import { ButtonLink } from '@/components/Button'
import { Container } from '@/components/Container'
import { ChapterControls } from '@/components/Chapter/ChapterControls'
import { Markdown } from '@/components/Markdown/Markdown'
import { client } from '@/api/client'
import { imageUrl } from '@/api/images'
import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getHike, getPhotos, getHikeNeighbors, type Hike } from '@/api/hikes'

import { hikePresentation, locationPresentation, visibleHikeCards } from '@/hiking/presentation'
import { pageMetadata } from '@/seo/metadata'
import { metadataDescription } from '@/seo/text'
import { hikeLanguages, hikePath, hikeSharingImage } from '@/seo/urls'
import { siteIdentity } from '@/config/site'
import { hikeData } from '@/seo/structuredData'
import { StructuredData } from '@/components/StructuredData'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params

  if (!hasLocale(routing.locales, locale)) {
    return {}
  }

  const hike = await getHike(locale, slug)

  if (!hike) {
    notFound()
  }
  const t = await getTranslations({ locale, namespace: 'Site' })

  return pageMetadata({
    locale,
    title: hike.translation.title,
    description: metadataDescription(
      hike.translation.summary_markdown,
      t('metadataDescription'),
      hike.translation.geographic_label,
    ),
    path: hikePath(locale, hike.translation.slug),
    languages: hikeLanguages(hike.available_translations),
    image: hike.cover_image_url ? hikeSharingImage(locale, hike.translation.slug) : undefined,
    imageSize: siteIdentity.sharingImage,
    imageAlt: hike.cover_image_url ? hike.translation.title : t('sharingImageAlt'),
    article: true,
  })
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

  return (
    <div>
      <HikeMasthead hike={hike} />
      <Suspense fallback={null}>
        <HikePageContent hike={hike} locale={locale} />
      </Suspense>
    </div>
  )
}

async function getTrackingMap(hike: Hike) {
  const params = { hike_id: hike.id }
  if (serverConfig.deploymentEnvironment === 'local') {
    const response = await client['/api/hikes/{hike_id}/tracking-replay'].get({ params })
    if (response.ok) {
      const replay = await response.json()
      if (replay.route) {
        return { route: replay.route, replay }
      }
    }
  }
  const response = await client['/api/hikes/{hike_id}/planned-map'].get({ params })
  return response.ok ? { route: await response.json() } : undefined
}

async function HikePageContent({ hike, locale }: { hike: Hike; locale: Locale }) {
  const [t, galleryPage, neighbors, trackingMap] = await Promise.all([
    getTranslations('Site'),
    getPhotos(hike.id, locale),
    getHikeNeighbors(hike.id, locale),
    getTrackingMap(hike).catch(() => undefined),
  ])
  const plannedMap = trackingMap?.route
  const presentation = hikePresentation(hike)
  const locationData = hike.location && locationPresentation(hike.location)
  const cards = visibleHikeCards(hike)
  const hasJourney = hasHikeJourney(presentation.details)
  const overviewItem: HikeNavigationItem = { id: 'resources', label: t('hikeOverview') }
  const navigationItems: HikeNavigationItem[] = [
    overviewItem,
    ...(hasJourney ? [{ id: 'journey' as const, label: t('journey.title') }] : []),
    { id: 'story', label: t('about') },

    ...(galleryPage.total > 0 ? [{ id: 'photos' as const, label: t('gallery.title') }] : []),
    ...(hike.location
      ? [{ id: 'trail' as const, label: t(`locationKind.${hike.location.kind}`) }]
      : []),
  ]

  const chapterControls = (
    <div className="mb-4 empty:hidden">
      <ChapterControls targetId="story" />
    </div>
  )
  const showFootsteps = Boolean(
    hike.translation.summary_markdown || hike.translation.description_markdown,
  )
  const hasTrailFooter = Boolean(hike.location && locationData)
  const storyWidth = showFootsteps
    ? '@footstep-story/hike-story:pr-(--spacing-footstep-gutter) @max-footstep-story/hike-story:[--article-max-inline-size:none]'
    : '[--article-max-inline-size:none]'

  return (
    <>
      <StructuredData
        data={hikeData(
          locale,
          hike,
          t('hikes'),
          hike.cover_image_url ? imageUrl(hike.cover_image_url) : undefined,
        )}
      />
      <section className="relative bg-cream" aria-label={t('hikeFacts')}>
        <HikeNavigation label={t('pageContents')} items={navigationItems} />
        <HikeOverview
          map={
            plannedMap ? (
              <DynamicHikeMap
                key={hike.id}
                hikeId={hike.id}
                hikeSlug={hike.translation.slug}
                route={plannedMap}
                ongoing={hike.status === 'ongoing'}
                replay={trackingMap.replay}
                completed={hike.status === 'completed'}
                aborted={hike.status === 'aborted'}
                areaName={hike.location?.kind === 'area' ? hike.location.name : undefined}
                hasMapShareCard={Boolean(hike.mapshare_url)}
              />
            ) : (
              <section id="map" aria-label={t('map.title')}>
                <MapUnavailable hasMapShareCard={Boolean(hike.mapshare_url)} />
              </section>
            )
          }
        >
          <HikeFacts hike={hike} endpoints={presentation.endpoints} />
          {cards.length > 0 && (
            <section aria-label={t('hikeResources')}>
              <InfoCards
                cards={cards}
                mapSharePassword={hike.mapshare_password ?? undefined}
                mapShareUrl={hike.mapshare_url ?? undefined}
                hikeId={hike.id}
                hikeTitle={hike.english_title}
                locale={locale}
              />
            </section>
          )}
        </HikeOverview>
        {hasJourney && (
          <div className="bg-forest-soft py-8 tablet:py-12">
            <Container>
              <HikeJourney
                details={presentation.details}
                status={hike.status}
                more={
                  hike.location && (
                    <ButtonLink
                      size="small"
                      variant="secondary"
                      href={{
                        pathname: '/hikes/[slug]',
                        params: { slug: hike.translation.slug },
                        hash: 'trail',
                      }}
                    >
                      {t(hike.location.kind === 'trail' ? 'moreAboutTrail' : 'moreAboutArea')}
                      <IconArrowDown className="size-4" aria-hidden="true" />
                    </ButtonLink>
                  )
                }
              />
            </Container>
          </div>
        )}
      </section>
      <Container>
        <div className="@container/hike-story relative isolate">
          {showFootsteps && <FootstepTrail />}
          <div className={`pt-10 tablet:pt-16 ${hasTrailFooter ? 'pb-12 tablet:pb-16' : ''}`}>
            <div className="grid gap-12 tablet:gap-16">
              <HikeSection id="story" title={t('about')} as="article" heading="prominent">
                <div className={storyWidth}>
                  {locale !== 'en' && (
                    <div className="mb-6">
                      <TranslationNotice />
                    </div>
                  )}
                  {!hike.translation.description_markdown && chapterControls}
                  {hike.translation.summary_markdown && (
                    <div className="mb-8">
                      <Markdown variant="article">{hike.translation.summary_markdown}</Markdown>
                    </div>
                  )}
                  {hike.translation.description_markdown && (
                    <>
                      {chapterControls}
                      <Markdown variant="article">{hike.translation.description_markdown}</Markdown>
                    </>
                  )}
                </div>
              </HikeSection>
              <HikeGallery
                key={hike.id}
                hikeId={hike.id}
                hikeTitle={hike.english_title}
                locale={locale}
                initialPage={galleryPage}
              />
            </div>
            <div className="mt-12 tablet:mt-16">
              <HikePagination neighbors={neighbors} />
            </div>
          </div>
        </div>
      </Container>
      {hike.location && locationData && (
        <TrailFooter>
          <Container>
            <TrailFacts
              location={hike.location}
              locale={locale}
              tags={locationData.tags}
              ratings={locationData.ratings}
              details={locationData.details}
            />
          </Container>
        </TrailFooter>
      )}
    </>
  )
}
