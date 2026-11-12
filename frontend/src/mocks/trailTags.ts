import 'server-only'

import { z } from 'zod'

import mockTagsJson from './trail-tags.json'

const tagSchema = z.enum([
  'mountains',
  'lowlands',
  'coastal',
  'loop',
  'lapland',
  'aboveArcticCircle',
  'crossesArcticCircle',
  'establishedRoute',
  'selfPlannedRoute',
  'waymarked',
  'partlyWaymarked',
  'unmarked',
])
const mockTags = z
  .array(z.object({ trail_id: z.uuid(), tags: z.array(tagSchema) }))
  .parse(mockTagsJson)

export type TrailTag = z.infer<typeof tagSchema>

export function getTrailTags(trailId: string): TrailTag[] {
  return mockTags.find((trail) => trail.trail_id === trailId)?.tags ?? []
}
