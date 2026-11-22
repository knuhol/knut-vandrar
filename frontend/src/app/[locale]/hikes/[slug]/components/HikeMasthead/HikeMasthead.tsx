import Image from 'next/image'
import { useTranslations } from 'next-intl'

import styles from './HikeMasthead.module.css'

import { Eyebrow } from '@/components/Eyebrow'
import { Heading } from '@/components/Heading'
import { Container } from '@/components/Container'
import { HikeStatus } from '@/app/[locale]/components/HikeStatus'
import { HikeStats } from '@/app/[locale]/components/HikeStats'
import { hikeSeason } from '@/hiking/season'
import { imageUrl } from '@/api/images'
import type { Hike } from '@/api/hikes'
import { Link } from '@/i18n/navigation'

export function HikeMasthead({ hike }: { hike: Hike }) {
  const t = useTranslations('Site')
  const period = hikeSeason(hike)

  return (
    <header
      className={`${styles.landscape} relative isolate flex items-end overflow-hidden bg-forest text-cream`}
    >
      {hike.cover_image_url && (
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <Image
            src={imageUrl(hike.cover_image_url)}
            alt={hike.translation.title}
            fill
            className={`${styles.photo} object-cover`}
            preload
            unoptimized
            sizes="100vw"
          />
        </div>
      )}
      <div className={`${styles.shade} pointer-events-none absolute inset-0 -z-10`} />
      <div className="absolute inset-x-0 top-0 z-10 py-5 tablet:py-7">
        <Container>
          <nav
            aria-label={t('breadcrumbs')}
            className={`${styles.readable} links-on-dark inline-flex max-w-full text-sm text-cream`}
          >
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <li>
                <Link
                  href={{ pathname: '/', hash: 'hikes' }}
                  className="text-cream underline decoration-2 decoration-transparent hover:decoration-current focus-visible:decoration-current"
                >
                  {t('hikes')}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{hike.translation.title}</li>
            </ol>
          </nav>
        </Container>
      </div>
      <Container>
        <div className="content-enter pt-32 pb-12 tablet:pt-40 tablet:pb-16">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <HikeStatus status={hike.status} />
          </div>
          {period && (
            <div className={`${styles.readable} mb-5`}>
              <Eyebrow tone="inverse">
                <time dateTime={period.start}>
                  {t('hikeSeason', { season: t(`seasons.${period.season}`), year: period.year })}
                </time>
              </Eyebrow>
            </div>
          )}
          <Heading tone="inverse">{hike.translation.title}</Heading>
          {hike.translation.tagline && (
            <p className="mt-5 max-w-reading text-xl leading-relaxed text-cream">
              {hike.translation.tagline}
            </p>
          )}
          <div className="mt-8">
            <HikeStats
              hike={{ ...hike, ascent_m: null }}
              fontSize="xl"
              className="gap-x-6 gap-y-3 [&_span]:gap-2"
            />
          </div>
        </div>
      </Container>
    </header>
  )
}
