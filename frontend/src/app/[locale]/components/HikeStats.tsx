import { useFormatter, useTranslations } from 'next-intl'
import { IconCalendar, IconMountain, IconFootsteps } from '@tabler/icons-react'

import type { HikeSummary } from '@/api/hikes'

const fontSizes = {
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}

export function HikeStats({
  hike,
  fontSize = 'base',
  className = '',
}: {
  hike: Pick<HikeSummary, 'duration_days' | 'distance_km' | 'ascent_m'>
  fontSize?: keyof typeof fontSizes
  className?: string
}) {
  const t = useTranslations('Site')
  const format = useFormatter()

  if (hike.duration_days === null && hike.distance_km === null && hike.ascent_m === null) {
    return null
  }

  return (
    <div
      className={`flex flex-wrap items-center font-statistic [&_span]:inline-flex [&_span]:items-center [&_span]:whitespace-nowrap [&_svg]:size-4.5 [&_svg]:shrink-0 ${fontSizes[fontSize]} ${className}`}
    >
      {hike.duration_days !== null && (
        <span>
          <IconCalendar aria-hidden="true" />
          {t('days', { count: hike.duration_days })}
        </span>
      )}
      {hike.distance_km !== null && (
        <span>
          <IconFootsteps aria-hidden="true" />
          {t('distance', { value: format.number(hike.distance_km) })}
        </span>
      )}
      {hike.ascent_m !== null && (
        <span title={t('ascent')}>
          <IconMountain aria-hidden="true" />
          {t('elevation', { value: format.number(hike.ascent_m) })}
        </span>
      )}
    </div>
  )
}
