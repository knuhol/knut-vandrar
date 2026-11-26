'use client'

import { useTranslations } from 'next-intl'

import { useHikeActivity } from '@/components/HikeActivity'

export function HikeLiveBadge({ slug }: { slug: string }) {
  const t = useTranslations('Site')
  const activity = useHikeActivity()

  if (activity?.slug !== slug || !activity.sending) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-live-position-soft px-3.25 py-1 font-statistic text-sm font-bold text-ink">
      <span
        className="live-position-pulse relative size-2.5 shrink-0 rounded-full border border-paper bg-live-position"
        aria-hidden="true"
      />
      {t('hikeLiveBadge')}
    </span>
  )
}
