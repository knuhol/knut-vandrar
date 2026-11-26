'use client'

import { useEffect, useState, type ReactNode } from 'react'

import {
  ActivityContext,
  PublishActivityContext,
  isSendingLive,
  liveRefreshMs,
  type HikeActivity,
} from './HikeActivity'

import { trackingClient, type OngoingHike } from '@/api/tracking'
import { publicConfig } from '@/config/public'
import type { Locale } from '@/i18n/routing'

const client = trackingClient(publicConfig.apiBaseUrl)

export function HikeActivityProvider({
  locale,
  initialHike,
  children,
}: {
  locale: Locale
  initialHike: OngoingHike | null
  children: ReactNode
}) {
  const [hike, setHike] = useState(initialHike)
  const [sendingHikeId, setSendingHikeId] = useState<string>()
  const [mapActivity, setMapActivity] = useState<HikeActivity>()
  const mapControlsStatus = mapActivity !== undefined

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      try {
        const response = await client['/api/hikes/ongoing'].get({
          query: { locale },
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Ongoing hike request failed')
        }
        const current = await response.json()
        controller.signal.throwIfAborted()
        setHike(current)
        if (!current) {
          setSendingHikeId(undefined)
          return
        }
        if (mapControlsStatus) {
          return
        }
        const result = await client['/api/hikes/{hike_id}/tracking-progress'].get({
          params: { hike_id: current.id },
          signal: controller.signal,
        })
        const progress = result.ok ? await result.json() : undefined
        controller.signal.throwIfAborted()
        setSendingHikeId(isSendingLive(progress, Date.now()) ? current.id : undefined)
      } catch {
        if (!controller.signal.aborted) {
          setSendingHikeId(undefined)
        }
      } finally {
        if (!controller.signal.aborted) {
          timer = globalThis.setTimeout(() => void refresh(), liveRefreshMs)
        }
      }
    }

    void refresh()
    return () => {
      controller.abort()
      globalThis.clearTimeout(timer)
    }
  }, [locale, mapControlsStatus])

  const activity =
    mapActivity && (mapActivity.replay || mapActivity.slug === hike?.slug)
      ? mapActivity
      : hike
        ? { slug: hike.slug, sending: sendingHikeId === hike.id }
        : undefined
  return (
    <PublishActivityContext.Provider value={setMapActivity}>
      <ActivityContext.Provider value={activity}>{children}</ActivityContext.Provider>
    </PublishActivityContext.Provider>
  )
}
