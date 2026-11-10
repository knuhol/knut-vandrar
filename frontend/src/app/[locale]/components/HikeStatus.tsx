import { useTranslations } from 'next-intl'

import type { HikeSummary } from '@/lib/hikes'

const colors = {
  completed: 'bg-completed text-completed-ink',
  planned: 'bg-planned text-planned-ink',
  ongoing: 'bg-ongoing text-ongoing-ink',
  aborted: 'bg-aborted text-aborted-ink',
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
      className={`inline-flex rounded-pill px-3.25 py-1 text-status font-bold ${colors[status]} ${className}`}
    >
      {t(status)}
    </span>
  )
}
