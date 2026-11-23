import { useTranslations } from 'next-intl'
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'

import type { getHikeNeighbors } from '@/api/hikes'
import { Link } from '@/i18n/navigation'

export function HikePagination({
  neighbors,
}: {
  neighbors: Awaited<ReturnType<typeof getHikeNeighbors>>
}) {
  const t = useTranslations('Site')
  if (!neighbors.previous && !neighbors.next) {
    return null
  }

  return (
    <nav
      aria-label={t('hikeNavigation')}
      className="grid grid-cols-1 gap-6 tablet:grid-cols-2 border-t border-beige pt-8"
    >
      {(['previous', 'next'] as const).map((direction) => {
        const neighbor = neighbors[direction]
        if (!neighbor) {
          return null
        }
        const next = direction === 'next'
        const Arrow = next ? IconArrowRight : IconArrowLeft

        return (
          <Link
            key={direction}
            href={{ pathname: '/hikes/[slug]', params: { slug: neighbor.slug } }}
            data-link-kind="directional"
            className={`directional-link group block min-w-0 text-forest ${next ? 'text-left tablet:col-start-2 tablet:text-right' : ''}`}
          >
            <span
              className={`inline-flex items-center gap-2 text-sm text-muted group-hover:text-forest group-focus-visible:text-forest ${next ? 'flex-row-reverse' : ''}`}
            >
              <Arrow className="size-5 text-forest" aria-hidden="true" />
              {t(next ? 'nextHike' : 'previousHike')}
            </span>
            <span className="mt-1 block font-display text-base leading-tight font-semibold tablet:text-lg">
              {neighbor.title}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
