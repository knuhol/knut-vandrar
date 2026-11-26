'use client'

import { createContext, useContext } from 'react'

import type { TrackingProgress } from '@/api/tracking'

export const liveRefreshMs = 30_000
export const freshFixWindowMs = 30 * 60 * 1000

export type HikeActivity = { slug: string; sending: boolean; replay?: boolean }
export const ActivityContext = createContext<HikeActivity | undefined>(undefined)
export const PublishActivityContext = createContext<
  ((activity?: HikeActivity) => void) | undefined
>(undefined)

export function isSendingLive(progress: TrackingProgress | undefined, now: number | undefined) {
  const recorded = progress?.latest_recorded_at
  return (
    progress?.status === 'active' &&
    Boolean(progress.position) &&
    recorded != null &&
    now !== undefined &&
    now - Date.parse(recorded) < freshFixWindowMs
  )
}

export function useHikeActivity() {
  return useContext(ActivityContext)
}

export function usePublishHikeActivity() {
  return useContext(PublishActivityContext)
}
