'use client'

import { useEffect, useId, useState } from 'react'
import { IconInfoCircle } from '@tabler/icons-react'
import { useFormatter, useTranslations } from 'next-intl'

import { RouteMap } from './RouteMap'

import {
  trackingClient,
  type PlannedMap,
  type TrackingProgress,
  type TrackingReplay,
} from '@/api/tracking'
import { publicConfig } from '@/config/public'

import { isSendingLive, liveRefreshMs, usePublishHikeActivity } from '@/components/HikeActivity'

const client = trackingClient(publicConfig.apiBaseUrl)
const minuteMs = 60_000
const replayRefreshMs = 1000
const replayMinutesPerSecond = 60
const replayTimeMultiplier = replayMinutesPerSecond * 60

export function DynamicHikeMap({
  hikeId,
  hikeSlug,
  route: initialRoute,
  ongoing,
  replay,
  completed: hikeCompleted,
  aborted,
  areaName,
  hasMapShareCard,
}: {
  hikeId: string
  hikeSlug?: string
  route: PlannedMap
  ongoing?: boolean
  replay?: TrackingReplay
  completed?: boolean
  aborted?: boolean
  areaName?: string
  hasMapShareCard?: boolean
}) {
  const t = useTranslations('Site.map')
  const format = useFormatter()
  const statsId = useId()
  const [statsOpen, setStatsOpen] = useState(true)
  const [route, setRoute] = useState(initialRoute)
  const [progress, setProgress] = useState<TrackingProgress | undefined>(replay?.progress)
  const replayStart = replay ? Date.parse(replay.start) : undefined
  const replayEnd = replay ? Date.parse(replay.end) : undefined
  const [effectiveTime, setEffectiveTime] = useState(replayStart)

  useEffect(() => {
    if (!ongoing && replayStart === undefined) {
      return
    }
    const startedAt = performance.now()
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      const clock =
        replayStart === undefined || replayEnd === undefined
          ? undefined
          : Math.min(
              replayEnd,
              replayStart + (performance.now() - startedAt) * replayTimeMultiplier,
            )
      let replayFinished = false
      try {
        if (clock !== undefined) {
          const response = await client['/api/hikes/{hike_id}/tracking-replay'].get({
            params: { hike_id: hikeId },
            query: { at: new Date(clock).toISOString() },
            signal: controller.signal,
          })
          if (!response.ok) {
            throw new Error('Tracking request failed')
          }
          const result = await response.json()
          if (!controller.signal.aborted) {
            setProgress(result.progress)
            setEffectiveTime(clock)
            replayFinished = clock === replayEnd
          }
          return
        }
        const params = { hike_id: hikeId }
        const result = await client['/api/hikes/{hike_id}/tracking-progress'].get({
          params,
          signal: controller.signal,
        })
        if (!result.ok) {
          throw new Error('Tracking request failed')
        }
        const update = await result.json()
        if (update.revision !== route.revision) {
          const response = await client['/api/hikes/{hike_id}/planned-map'].get({
            params,
            signal: controller.signal,
          })
          if (!response.ok) {
            throw new Error('Tracking request failed')
          }
          const replacement = await response.json()
          if (!controller.signal.aborted) {
            setRoute(replacement)
          }
        }
        if (!controller.signal.aborted) {
          setProgress(update)
          setEffectiveTime(Date.now())
        }
      } catch {
        // Preserve the last position and retry at the normal refresh interval.
      } finally {
        if (!controller.signal.aborted && !replayFinished) {
          timer = globalThis.setTimeout(
            () => void refresh(),
            clock === undefined ? liveRefreshMs : replayRefreshMs,
          )
        }
      }
    }
    void refresh()
    return () => {
      controller.abort()
      globalThis.clearTimeout(timer)
    }
  }, [hikeId, ongoing, replayStart, replayEnd, route.revision])

  const shown = progress?.revision === route.revision ? progress : undefined
  const lastFix = shown?.latest_recorded_at
  const lastFixTime = lastFix ? Date.parse(lastFix) : undefined
  useEffect(() => {
    if (!ongoing || replayStart !== undefined || lastFixTime === undefined) {
      return
    }
    const recordedAt = lastFixTime
    let timer: ReturnType<typeof setTimeout>
    function scheduleTick(now: number) {
      const elapsed = now - recordedAt
      const nextMinute = elapsed < 0 ? minuteMs - elapsed : minuteMs - (elapsed % minuteMs)
      timer = globalThis.setTimeout(() => {
        const time = Date.now()
        setEffectiveTime(time)
        scheduleTick(time)
      }, nextMinute)
    }
    scheduleTick(Date.now())
    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [lastFixTime, ongoing, replayStart])

  const interval = shown?.tracking_interval_minutes
  const currentSpeed = shown?.current_walking_metres_per_hour
  const elapsedMinutes =
    lastFixTime !== undefined && effectiveTime !== undefined
      ? Math.max(0, Math.floor((effectiveTime - lastFixTime) / minuteMs))
      : undefined
  const trackingReadout =
    interval != null && elapsedMinutes !== undefined
      ? {
          text: t('trackingInterval', { elapsed: elapsedMinutes, interval }),
          color:
            elapsedMinutes > 2 * interval
              ? 'text-status-error-ink'
              : elapsedMinutes > 1.5 * interval
                ? 'text-status-warning-ink'
                : undefined,
        }
      : undefined
  const sending = isSendingLive(shown, effectiveTime)
  const publishActivity = usePublishHikeActivity()
  const replaying = replay !== undefined
  const showActivity = Boolean(ongoing) || replaying

  useEffect(() => {
    if (showActivity && hikeSlug) {
      publishActivity?.({ slug: hikeSlug, sending, replay: replaying })
    }
  }, [hikeSlug, publishActivity, replaying, sending, showActivity])

  useEffect(() => {
    return () => {
      publishActivity?.()
    }
  }, [hikeSlug, publishActivity])

  const completed = shown?.completed ?? 0
  const finished = shown?.remaining === 0 && route.total > 0
  const percentage = finished ? 100 : Math.min(99, Math.round(shown?.percentage ?? 0))
  const firstFixTime = shown?.first_recorded_at
  const millisecondsPerMinute = 60 * 1000
  const elapsedMilliseconds =
    firstFixTime && effectiveTime !== undefined
      ? Math.max(0, effectiveTime - Date.parse(firstFixTime))
      : undefined
  const elapsedHours =
    elapsedMilliseconds === undefined
      ? undefined
      : elapsedMilliseconds / (60 * millisecondsPerMinute)
  let elapsedTime: string | undefined
  if (elapsedMilliseconds !== undefined) {
    const minutes = Math.floor(elapsedMilliseconds / millisecondsPerMinute)
    const hours = Math.floor(minutes / 60)
    if (hours < 1) {
      elapsedTime = t('elapsedHikeMinutes', { minutes })
    } else if (hours < 24) {
      elapsedTime = t('elapsedHikeHoursAndMinutes', { hours, minutes: minutes % 60 })
    } else {
      elapsedTime = t('elapsedHikeTime', { days: Math.floor(hours / 24), hours: hours % 24 })
    }
  }

  const metersPerHour =
    elapsedHours !== undefined && elapsedHours >= 72 ? completed / elapsedHours : undefined
  const walkingPace = shown?.walking_metres_per_hour
  let estimate: string | undefined
  if (shown && metersPerHour !== undefined && metersPerHour > 0 && !finished) {
    const daysLeft = shown.remaining / metersPerHour / 24
    const withinFinalDay = daysLeft < 1
    if (withinFinalDay && walkingPace != null && walkingPace > 0) {
      estimate = t('estimatedHikeHours', {
        hours: Math.max(1, Math.round(shown.remaining / walkingPace)),
      })
    } else {
      estimate = t('estimatedHikeDays', { days: Math.max(1, Math.round(daysLeft)) })
    }
  }
  const averageMetresPerDay = shown?.average_metres_per_day
  const percent = format.number(percentage / 100, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const kilometers = (meters: number) => format.number(meters / 1000, { maximumFractionDigits: 0 })

  return (
    <section id="map" aria-label={t('title')} className="min-w-0 scroll-mt-(--header-height)">
      {shown?.status === 'conflict' ? (
        <p role="status" className="p-3">
          {t('status.conflict')}
        </p>
      ) : (
        <RouteMap
          route={route}
          progress={shown}
          stalePosition={!sending}
          completed={hikeCompleted && !replay}
          aborted={aborted}
          areaName={areaName}
          hikeId={hikeId}
          hasMapShareCard={hasMapShareCard}
          overlayExpanded={statsOpen}
          overlay={
            (ongoing || replay) && (
              <div className="flex items-start rounded-sm bg-paper/95 text-sm text-ink shadow-sm">
                <button
                  type="button"
                  aria-label={t('trackingStats')}
                  aria-expanded={statsOpen}
                  aria-controls={statsId}
                  onClick={() => {
                    setStatsOpen(!statsOpen)
                  }}
                  className="pointer-events-auto grid size-10 shrink-0 cursor-pointer place-items-center rounded-sm focus-inset"
                >
                  <IconInfoCircle className="size-5" aria-hidden="true" />
                </button>
                <div id={statsId} hidden={!statsOpen} className="py-2 pr-3">
                  <div className="font-semibold">
                    {t('distanceProgress', {
                      current: kilometers(completed),
                      total: kilometers(route.total),
                      percent,
                    })}
                  </div>
                  {averageMetresPerDay != null && (
                    <div>
                      {t('averageHikeProgress', {
                        kilometers: kilometers(averageMetresPerDay),
                      })}
                    </div>
                  )}
                  {elapsedTime && <div>{elapsedTime}</div>}
                  {estimate && <div>{estimate}</div>}
                  {trackingReadout ? (
                    <div className="mt-1 italic">
                      {currentSpeed != null && (
                        <div>
                          {t('currentWalkingSpeed', {
                            speed: format.number(currentSpeed / 1000, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            }),
                          })}
                        </div>
                      )}
                      <div className={trackingReadout.color}>{trackingReadout.text}</div>
                    </div>
                  ) : (
                    lastFixTime !== undefined &&
                    effectiveTime !== undefined && (
                      <div className="mt-1 italic">
                        {t('lastPositionUpdate', {
                          time: format.relativeTime(lastFixTime, { now: effectiveTime }),
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          }
        />
      )}
    </section>
  )
}
