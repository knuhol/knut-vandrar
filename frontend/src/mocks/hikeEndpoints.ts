import 'server-only'

import { z } from 'zod'

import mockEndpointsJson from './hike-endpoints.json'

const coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
const endpoints = z.object({
  start: coordinates.nullable(),
  end: coordinates.nullable(),
})
const mockEndpoints = z.array(endpoints.extend({ hike_id: z.uuid() })).parse(mockEndpointsJson)

export type HikeEndpoints = z.infer<typeof endpoints>

export function getHikeEndpoints(hikeId: string) {
  return mockEndpoints.find((hike) => hike.hike_id === hikeId)
}
