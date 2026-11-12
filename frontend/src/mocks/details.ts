import 'server-only'

import { z } from 'zod'

import hikesJson from './hike-details.json'
import trailsJson from './trail-details.json'

import { hikeDetailsSchema, trailDetailsSchema } from '@/hiking/details'

const hikes = z.array(hikeDetailsSchema.extend({ hike_id: z.uuid() })).parse(hikesJson)
const trails = z.array(trailDetailsSchema.extend({ trail_id: z.uuid() })).parse(trailsJson)

export function getHikeDetails(id: string) {
  return hikes.find((hike) => hike.hike_id === id)
}

export function getTrailDetails(id: string) {
  return trails.find((trail) => trail.trail_id === id)
}
