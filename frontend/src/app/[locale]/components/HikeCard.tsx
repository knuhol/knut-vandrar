import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  IconArrowUpRight as ArrowUpRight,
  IconPhotoQuestion as PhotoQuestion,
} from '@tabler/icons-react'

import { HikeStats } from './HikeStats'
import { HikeStatus } from './HikeStatus'

import { Heading } from '@/components/Heading'
import { ButtonLink } from '@/components/Button'
import { imageUrl } from '@/api/images'
import type { HikeSummary } from '@/api/hikes'
import { hikeSeason } from '@/hiking/season'

export function HikeCard({ hike }: { hike: HikeSummary }) {
  const t = useTranslations('Site')
  const period = hikeSeason(hike)

  return (
    <article className="card-interactive relative isolate flex h-full flex-col overflow-hidden rounded-lg border border-beige bg-cream">
      <div className="relative h-60 shrink-0 bg-cream tablet:h-56.25">
        {hike.cover_image_url ? (
          <Image
            src={imageUrl(hike.cover_image_url)}
            alt={hike.translation.title}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          />
        ) : (
          <div className="grid h-full place-items-center bg-sage/40 text-forest">
            <PhotoQuestion className="size-12 shrink-0" aria-hidden="true" />
          </div>
        )}
        <HikeStatus status={hike.status} className="absolute top-3.75 left-3.75" />
      </div>
      <div className="flex flex-1 flex-col p-5.25">
        {period && (
          <p className="mb-2 text-sm text-muted">
            <time dateTime={period.start}>
              {t('hikeSeason', { season: t(`seasons.${period.season}`), year: period.year })}
            </time>
          </p>
        )}
        <div className="mb-4">
          <Heading as="h3">{hike.translation.title}</Heading>
        </div>
        <HikeStats
          hike={hike}
          fontSize="base"
          className="mt-auto gap-x-5 gap-y-3 text-forest [&_span]:gap-1.75"
        />
        <div className="mt-4">
          <ButtonLink
            size="small"
            stretched
            href={{
              pathname: '/hikes/[slug]',
              params: { slug: hike.translation.slug },
            }}
            aria-label={`${t('read')}: ${hike.translation.title}`}
          >
            {t('read')} <ArrowUpRight className="size-4.5 shrink-0" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </article>
  )
}
