import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'
import { IconArrowDown } from '@tabler/icons-react'

import { HikePagination } from './components/HikePagination'
import { HikeMap } from './components/HikeMap/HikeMap'

import { HikeGallery } from './components/HikeGallery/HikeGallery'

import { HikeNavigation, type HikeNavigationItem } from './components/HikeNavigation'
import { HikeSection } from './components/HikeSection/HikeSection'
import { HikeMasthead } from './components/HikeMasthead/HikeMasthead'
import { HikeOverview } from './components/HikeOverview/HikeOverview'
import { HikeJourney, hasHikeJourney } from './components/HikeJourney'
import { TrailFooter } from './components/TrailFooter/TrailFooter'
import { TrailFacts } from './components/TrailFacts'
import { TranslationNotice } from './components/TranslationNotice/TranslationNotice'

import { HikeFacts } from './components/HikeFacts'
import { ButtonLink } from '@/components/Button'
import { Container } from '@/components/Container'
import { ChapterControls } from '@/components/Chapter/ChapterControls'
import { Markdown } from '@/components/Markdown/Markdown'
import { imageUrl } from '@/api/images'
import { InfoCards } from '@/app/[locale]/hikes/[slug]/components/InfoCards'
import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getHike, getPhotos, getHikeMaps, getHikeNeighbors } from '@/api/hikes'

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
    description: metadataDescription(hike.translation.summary_markdown, t('metadataDescription')),
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

  const t = await getTranslations('Site')
  const [galleryPage, maps, neighbors] = await Promise.all([
    getPhotos(hike.id, locale),
    getHikeMaps(hike.id),
    getHikeNeighbors(hike.id, locale),
  ])
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

  return (
    <div>
      <StructuredData
        data={hikeData(
          locale,
          hike,
          t('hikes'),
          hike.cover_image_url ? imageUrl(hike.cover_image_url) : undefined,
        )}
      />
      <HikeMasthead hike={hike} />
      <section className="relative bg-cream" aria-label={t('hikeFacts')}>
        <HikeOverview
          map={
            maps.length > 0 ? (
              <HikeMap images={maps} hikeTitle={hike.translation.title} />
            ) : undefined
          }
        >
          <HikeFacts hike={hike} endpoints={presentation.endpoints} />
          {cards.length > 0 && (
            <section aria-label={t('hikeResources')}>
              <InfoCards
                cards={cards}
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
      <HikeNavigation label={t('pageContents')} items={navigationItems} />
      <div className="pt-10 tablet:pt-16">
        <Container>
          <div className="grid gap-12 tablet:gap-16">
            <HikeSection
              id="story"
              title={t('about')}
              as="article"
              heading="prominent"
              meta={<ChapterControls targetId="story" />}
            >
              <div>
                {locale !== 'en' && (
                  <div className="mb-6">
                    <TranslationNotice />
                  </div>
                )}
                {hike.translation.summary_markdown && (
                  <div className="mb-8">
                    <Markdown variant="article">{hike.translation.summary_markdown}</Markdown>
                  </div>
                )}
                {hike.translation.description_markdown && (
                  <Markdown variant="article">{hike.translation.description_markdown}</Markdown>
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
        </Container>
      </div>
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
    </div>
  )
}
