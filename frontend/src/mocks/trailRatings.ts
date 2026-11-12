import 'server-only'

import { z } from 'zod'

import mockRatingsJson from './trail-ratings.json'

const score = z.number().min(0).max(5).multipleOf(0.5)
const ratingsSchema = z.object({
  facilities: score,
  maintenance: score,
  publicTransport: score,
  resupplies: score,
  difficulty: score,
})
const mockRatings = z
  .array(z.object({ trail_id: z.uuid(), ratings: ratingsSchema }))
  .parse(mockRatingsJson)

export type TrailRatings = z.infer<typeof ratingsSchema>

export function getTrailRatings(trailId: string) {
  return mockRatings.find((trail) => trail.trail_id === trailId)?.ratings
}
