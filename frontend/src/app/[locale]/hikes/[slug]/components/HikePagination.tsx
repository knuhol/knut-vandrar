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
      {neighbors.previous && (
        <Link
          href={{ pathname: '/hikes/[slug]', params: { slug: neighbors.previous.slug } }}
          className="group block min-w-0 text-forest"
        >
          <span className="min-w-0">
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <IconArrowLeft className="size-5 text-forest" aria-hidden="true" />
              {t('previousHike')}
            </span>
            <span className="mt-1 block font-display text-base leading-tight font-semibold tablet:text-lg">
              {neighbors.previous.title}
            </span>
          </span>
        </Link>
      )}
      {neighbors.next && (
        <Link
          href={{ pathname: '/hikes/[slug]', params: { slug: neighbors.next.slug } }}
          className="group block min-w-0 text-left text-forest tablet:col-start-2 tablet:text-right"
        >
          <span className="min-w-0">
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              {t('nextHike')}
              <IconArrowRight className="size-5 text-forest" aria-hidden="true" />
            </span>
            <span className="mt-1 block font-display text-base leading-tight font-semibold tablet:text-lg">
              {neighbors.next.title}
            </span>
          </span>
        </Link>
      )}
    </nav>
  )
}
