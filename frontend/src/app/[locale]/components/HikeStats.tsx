import { useFormatter, useTranslations } from 'next-intl'
import { IconCalendar, IconMountain, IconFootsteps } from '@tabler/icons-react'

import type { HikeSummary } from '@/api/hikes'

const variants = {
  card: 'gap-x-5 gap-y-3 text-base text-forest [&_span]:gap-1.75',
  cover: 'gap-x-6 gap-y-3 text-xl [&_span]:gap-2',
  overview: 'gap-x-3 gap-y-3 text-lg text-forest tablet:gap-x-4 wide:text-xl [&_span]:gap-2',
}

export function HikeStats({
  hike,
  variant = 'card',
}: {
  hike: Pick<HikeSummary, 'duration_days' | 'distance_km' | 'ascent_m'>
  variant?: keyof typeof variants
}) {
  const t = useTranslations('Site')
  const format = useFormatter()

  if (hike.duration_days === null && hike.distance_km === null && hike.ascent_m === null) {
    return null
  }

  return (
    <div
      className={`flex flex-wrap items-center font-statistic [&_span]:inline-flex [&_span]:items-center [&_span]:whitespace-nowrap [&_svg]:size-4.5 [&_svg]:shrink-0 ${variants[variant]}`}
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
