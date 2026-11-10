import { useFormatter, useTranslations } from 'next-intl'
import { IconCalendar, IconMountain, IconFootsteps } from '@tabler/icons-react'

import type { HikeSummary } from '@/lib/hikes'

export function HikeStats({
  hike,
  variant = 'card',
}: {
  hike: Pick<HikeSummary, 'duration_days' | 'distance_km' | 'ascent_m'>
  variant?: 'card' | 'detail'
}) {
  const t = useTranslations('Site')
  const format = useFormatter()
  return (
    <div
      className={`flex flex-wrap items-center text-forest [&_span]:inline-flex [&_span]:items-center [&_span]:whitespace-nowrap [&_svg]:shrink-0 ${variant === 'detail' ? 'mt-7 gap-4.25 rounded-menu bg-cream p-4.5 font-statistic text-statistic-mobile tablet:gap-8 tablet:px-6.75 tablet:py-5.5 tablet:text-statistic [&_span]:gap-2.5 [&_svg]:size-icon' : 'mt-5 gap-x-5 gap-y-3 border-t border-line pt-3.75 text-copy [&_span]:gap-1.75'}`}
    >
      {hike.duration_days !== null && (
        <span>
          <IconCalendar className="size-4.5 shrink-0" aria-hidden="true" />
          {t('days', { count: hike.duration_days })}
        </span>
      )}
      {hike.distance_km !== null && (
        <span>
          <IconFootsteps className="size-4.5 shrink-0" aria-hidden="true" />
          {t('distance', { value: format.number(hike.distance_km) })}
        </span>
      )}
      {hike.ascent_m !== null && (
        <span title={t('ascent')}>
          <IconMountain className="size-4.5 shrink-0" aria-hidden="true" />
          {t('elevation', { value: format.number(hike.ascent_m) })}
        </span>
      )}
    </div>
  )
}
