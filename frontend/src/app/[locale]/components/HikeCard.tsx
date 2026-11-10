import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { IconArrowUpRight as ArrowUpRight, IconMountain as Mountain } from '@tabler/icons-react'

import { HikeStats } from './HikeStats'
import { HikeStatus } from './HikeStatus'
import { Markdown } from '@/components/Markdown'

import { Heading } from '@/components/Heading'
import { imageUrl } from '@/lib/images'
import { hikePath, type Locale } from '@/i18n/routing'
import type { HikeSummary } from '@/lib/hikes'

export function HikeCard({ hike, locale }: { hike: HikeSummary; locale: Locale }) {
  const t = useTranslations('Site')
  return (
    <article className="group overflow-hidden rounded-card border border-line bg-paper transition-[transform,box-shadow] duration-(--motion-fade) hover:-translate-y-1 hover:shadow-card">
      <Link
        href={hikePath(locale, hike.translation.slug)}
        aria-label={`${t('read')}: ${hike.translation.title}`}
        className="block h-full"
      >
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
            <div className="grid h-full place-items-center bg-placeholder text-forest">
              <Mountain className="size-12 shrink-0" aria-hidden="true" />
            </div>
          )}
          <HikeStatus status={hike.status} className="absolute top-3.75 left-3.75" />
        </div>
        <div className="p-5.25">
          <Heading as="h3" className="mb-3">
            {hike.translation.title}
          </Heading>
          <Markdown
            variant="summary"
            className="line-clamp-3 text-copy text-muted tablet:min-h-(--summary-height) [&_p]:m-0"
          >
            {hike.translation.summary_markdown}
          </Markdown>
          <HikeStats hike={hike} />
          <span className="mt-5 inline-flex items-center gap-2.5 rounded-action bg-orange px-3.75 py-2.25 text-action font-semibold text-ink group-hover:bg-orange-dark group-has-focus-visible:bg-orange-dark">
            {t('read')} <ArrowUpRight className="size-4.5 shrink-0" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  )
}
