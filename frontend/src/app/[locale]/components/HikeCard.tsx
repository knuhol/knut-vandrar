import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconArrowUpRight as ArrowUpRight, IconMountain as Mountain } from '@tabler/icons-react'

import { HikeStats } from './HikeStats'
import { HikeStatus } from './HikeStatus'
import { Markdown } from '@/components/Markdown/Markdown'

import { Heading } from '@/components/Heading'
import { ButtonLink } from '@/components/Button'
import { imageUrl } from '@/api/images'
import type { HikeSummary } from '@/api/hikes'

export function HikeCard({ hike }: { hike: HikeSummary }) {
  const t = useTranslations('Site')

  return (
    <article className="card-interactive relative isolate overflow-hidden rounded-lg border border-beige bg-cream">
      <div className="relative h-60 bg-cream tablet:h-56.25">
        {hike.cover_image_url ? (
          <Image
            src={imageUrl(hike.cover_image_url)}
            alt=""
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          />
        ) : (
          <div className="grid h-full place-items-center bg-beige text-forest">
            <Mountain className="size-12 shrink-0" aria-hidden="true" />
          </div>
        )}
        <HikeStatus status={hike.status} className="absolute top-3.75 left-3.75" />
      </div>
      <div className="p-5.25">
        <div className="mb-3">
          <Heading as="h3">{hike.translation.title}</Heading>
        </div>
        <Markdown variant="summary">{hike.translation.summary_markdown}</Markdown>
        <HikeStats
          hike={hike}
          fontSize="base"
          className="mt-5 gap-x-5 gap-y-3 border-t border-beige pt-3.75 text-forest [&_span]:gap-1.75"
        />
        <div className="mt-5">
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
