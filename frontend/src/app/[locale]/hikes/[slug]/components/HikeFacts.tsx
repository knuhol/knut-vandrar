import { useFormatter, useTranslations } from 'next-intl'
import { IconArrowRight as ArrowRight } from '@tabler/icons-react'

import { EndpointLocation } from './EndpointLocation'

import { HikeStats } from '@/app/[locale]/components/HikeStats'
import { Heading } from '@/components/Heading'
import type { Hike } from '@/api/hikes'
import type { HikeEndpoints } from '@/hiking/presentation'

export function HikeFacts({ hike, endpoints }: { hike: Hike; endpoints?: HikeEndpoints }) {
  const t = useTranslations('Site')
  const format = useFormatter()
  const start = hike.status === 'planned' ? hike.planned_start_at : hike.actual_start_at
  const end = hike.status === 'planned' ? hike.planned_end_at : hike.actual_end_at
  const hasStats =
    hike.duration_days != null || hike.distance_km != null || hike.ascent_m != null

  return (
    <div className="min-w-0">
      <div className="sr-only">
        <Heading as="h2" className="text-xl">
          {t('hikeFacts')}
        </Heading>
      </div>
      <div className="grid gap-4.5 tablet:gap-6">
        {(hike.start_point || hike.end_point || endpoints?.start || endpoints?.end) && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 [&_dt]:text-xs [&_dt]:text-muted [&_dd]:min-w-0 [&_dd]:text-base [&_dd]:font-semibold [&_dd]:wrap-break-word [&_dd]:text-forest">
            {(hike.start_point || endpoints?.start) && (
              <div className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt>{t('start')}</dt>
                <dd>
                  <EndpointLocation
                    name={hike.start_point}
                    coordinates={endpoints?.start}
                    stage={hike.start_stage}
                  />
                </dd>
              </div>
            )}
            {(hike.end_point || endpoints?.end) && (
              <div className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt>{t('finish')}</dt>
                <dd>
                  <EndpointLocation
                    name={hike.end_point}
                    coordinates={endpoints?.end}
                    stage={hike.end_stage}
                  />
                </dd>
              </div>
            )}
          </dl>
        )}
        <dl>
          {(hasStats || start) && (
            <div className="grid gap-2">
              {hasStats && (
                <>
                  <dt className="sr-only">{t('hikeStats')}</dt>
                  <dd>
                    <HikeStats
                      hike={hike}
                      fontSize="lg"
                      className="gap-x-3 gap-y-3 text-forest tablet:gap-x-4 wide:text-xl [&_span]:gap-2"
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
      </div>
    </div>
  )
}
