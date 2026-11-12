import { useFormatter, useTranslations } from 'next-intl'
import { IconArrowRight as ArrowRight } from '@tabler/icons-react'

import { EndpointLocation } from './EndpointLocation'
import { HikeJourney } from './HikeJourney'

import { HikeStats } from '@/app/[locale]/components/HikeStats'
import { Heading } from '@/components/Heading'
import type { Hike } from '@/api/hikes'
import type { HikeEndpoints } from '@/hiking/presentation'
import type { HikeDetails } from '@/hiking/details'

export function HikeFacts({
  hike,
  endpoints,
  details,
}: {
  hike: Hike
  endpoints?: HikeEndpoints
  details?: HikeDetails
}) {
  const t = useTranslations('Site')
  const format = useFormatter()
  const start = hike.status === 'planned' ? hike.planned_start_at : hike.actual_start_at
  const end = hike.status === 'planned' ? hike.planned_end_at : hike.actual_end_at
  const hasStats =
    hike.duration_days !== null || hike.distance_km !== null || hike.ascent_m !== null

  return (
    <div className="min-w-0 rounded-lg border border-beige bg-cream p-5">
      <div className="mb-4">
        <Heading as="h2" className="text-xl">
          {t('hikeFacts')}
        </Heading>
      </div>
      <div className="grid gap-4.5 tablet:grid-cols-2 tablet:gap-8">
        <dl>
          {(hasStats || start) && (
            <div className="grid gap-2">
              {hasStats && (
                <>
                  <dt className="sr-only">{t('hikeStats')}</dt>
                  <dd>
                    <HikeStats
                      hike={hike}
                      className="gap-x-4 gap-y-3 text-forest [&_span]:gap-1.5"
                    />
                  </dd>
                </>
              )}
              {start && (
                <>
                  <dt className="sr-only">{t('dates')}</dt>
                  <dd>
                    <div className="flex flex-wrap items-center gap-1.75 text-sm text-muted">
                      <time dateTime={start}>
                        {format.dateTime(new Date(start), {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                      {end && (
                        <>
                          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                          <time dateTime={end}>
                            {format.dateTime(new Date(end), {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </time>
                        </>
                      )}
                    </div>
                  </dd>
                </>
              )}
            </div>
          )}
        </dl>
        {(hike.start_point || hike.end_point || endpoints?.start || endpoints?.end) && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 [&_dt]:text-xs [&_dt]:text-muted [&_dd]:min-w-0 [&_dd]:text-base [&_dd]:font-semibold [&_dd]:wrap-break-word [&_dd]:text-forest">
            {(hike.start_point || endpoints?.start) && (
              <div className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt>{t('start')}</dt>
                <dd>
                  <EndpointLocation name={hike.start_point} coordinates={endpoints?.start} />
                </dd>
              </div>
            )}
            {(hike.end_point || endpoints?.end) && (
              <div className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt>{t('finish')}</dt>
                <dd>
                  <EndpointLocation name={hike.end_point} coordinates={endpoints?.end} />
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
      {details && <HikeJourney details={details} status={hike.status} />}
    </div>
  )
}
