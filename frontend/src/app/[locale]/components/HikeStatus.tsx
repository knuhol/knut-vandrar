import { useTranslations } from 'next-intl'

import type { HikeSummary } from '@/api/hikes'

const colors = {
  completed: 'bg-forest text-cream',
  planned: 'bg-beige text-ink',
  ongoing: 'bg-orange text-ink',
  aborted: 'bg-muted text-cream',
}

export function HikeStatus({
  status,
  className = '',
}: {
  status: HikeSummary['status']
  className?: string
}) {
  const t = useTranslations('Site')

  return (
    <span
      className={`inline-flex rounded-full px-3.25 py-1 font-statistic text-sm font-bold ${colors[status]} ${className}`}
    >
      {t(status)}
    </span>
  )
}
