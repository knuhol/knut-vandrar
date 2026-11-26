import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  IconArrowUpRight as ArrowUpRight,
  IconPhotoQuestion as PhotoQuestion,
} from '@tabler/icons-react'

import { HikeCardLink } from './HikeCardLink'
import { HikeLiveBadge } from './HikeLiveBadge'
import { HikeStats } from './HikeStats'
import { HikeStatus } from './HikeStatus'

import { Heading } from '@/components/Heading'
import { hikeCoverSources } from '@/api/images'
import type { HikeSummary } from '@/api/hikes'
import { hikeSeason } from '@/hiking/season'

export function HikeCard({ hike }: { hike: HikeSummary }) {
  const t = useTranslations('Site')
  const period = hikeSeason(hike)
  const covers = hikeCoverSources(hike)

  return (
    <article className="card-interactive relative isolate flex h-full flex-col overflow-hidden rounded-lg border border-beige bg-cream">
      <div className="relative h-60 shrink-0 bg-cream tablet:h-56.25">
        {covers ? (
          <Image
            src={covers.card}
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
        <div className="absolute top-3.75 left-3.75 flex flex-wrap items-center gap-2">
          <HikeStatus status={hike.status} />
          {hike.status === 'ongoing' && <HikeLiveBadge slug={hike.translation.slug} />}
        </div>
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
        <div className="mt-auto">
          <HikeStats hike={hike} />
        </div>
        <div className="mt-4">
          <HikeCardLink
            slug={hike.translation.slug}
            covers={covers}
            label={`${t('read')}: ${hike.translation.title}`}
          >
            {t('read')} <ArrowUpRight className="size-4.5 shrink-0" aria-hidden="true" />
          </HikeCardLink>
        </div>
      </div>
    </article>
  )
}
