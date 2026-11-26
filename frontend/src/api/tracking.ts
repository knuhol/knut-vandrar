import { createClient, type FromSchema, type NormalizeOAS } from 'fets'

import type { openapi } from '@/generated/openapi'

type Api = typeof openapi
type MapPaths =
  | '/api/hikes/ongoing'
  | '/api/hikes/{hike_id}/tracking-replay'
  | '/api/hikes/{hike_id}/planned-map'
  | '/api/hikes/{hike_id}/tracking-progress'
type MapApi = NormalizeOAS<Omit<Api, 'paths'> & { paths: Pick<Api['paths'], MapPaths> }>
type Schemas = MapApi['components']['schemas']

export type OngoingHike = FromSchema<Schemas['OngoingHikeRead']>
export type PlannedMap = FromSchema<Schemas['PlannedMap']>
export type TrackingProgress = FromSchema<Schemas['Progress']>
export type TrackingReplay = FromSchema<Schemas['Replay']>

export function trackingClient(endpoint: string) {
  return createClient<MapApi>({ endpoint, globalParams: { cache: 'no-store' } })
}
