import { useFormatter, useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconArrowRight as ArrowRight, IconArrowUpRight as ArrowUpRight } from '@tabler/icons-react'

import type { Locale } from '@/i18n/routing'
import { imageUrl } from '@/api/images'
import type { Hike } from '@/api/hikes'

export function HikeFacts({ hike, locale }: { hike: Hike; locale: Locale }) {
  const t = useTranslations('Site')
  const format = useFormatter()
  const start = hike.status === 'planned' ? hike.planned_start_at : hike.actual_start_at
  const end = hike.status === 'planned' ? hike.planned_end_at : hike.actual_end_at
  const countries = new Intl.DisplayNames([locale], { type: 'region' })

  return (
    <aside className="order-first self-start rounded-lg border border-beige bg-cream p-6.25 tablet:order-none">
      <dl className="[&_dt]:mt-4.5 [&_dt]:font-statistic [&_dt]:text-xs [&_dt]:tracking-widest [&_dt]:text-muted [&_dt]:uppercase [&_dt:first-child]:mt-0 [&_dd]:my-0.75 [&_dd]:flex [&_dd]:flex-wrap [&_dd]:items-center [&_dd]:gap-1.75 [&_dd]:text-base [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a]:underline [&_svg]:shrink-0">
        {start && (
          <>
            <dt>{t('dates')}</dt>
            <dd>
              {format.dateTime(new Date(start), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {end && (
                <>
                  {' '}
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />{' '}
                  {format.dateTime(new Date(end), {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </>
              )}
            </dd>
          </>
        )}
        {hike.start_point && (
          <>
            <dt>{t('start')}</dt>
            <dd>{hike.start_point}</dd>
          </>
        )}
        {hike.end_point && (
          <>
            <dt>{t('finish')}</dt>
            <dd>{hike.end_point}</dd>
          </>
        )}
        {hike.trail && (
          <>
            <dt>{t('trail')}</dt>
            <dd>
              {hike.trail.official_url ? (
                <a href={hike.trail.official_url} rel="noopener noreferrer" target="_blank">
                  {hike.trail.name} <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                </a>
              ) : (
                hike.trail.name
              )}
            </dd>
            <dt>{t('country')}</dt>
            <dd>
              {hike.trail.country_codes.map((code) => countries.of(code) ?? code).join(', ')} ·{' '}
              {t(hike.trail.type)}
            </dd>
          </>
        )}
      </dl>
      {hike.trail?.logo_url && (
        <div className="mt-5.75 border-t border-beige pt-5">
          <Image
            src={imageUrl(hike.trail.logo_url)}
            alt={hike.trail.name}
            width={220}
            height={90}
            className="h-auto max-h-25 max-w-full object-contain"
            unoptimized
          />
        </div>
      )}
    </aside>
  )
}
