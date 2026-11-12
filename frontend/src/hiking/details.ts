import { z } from 'zod'

export const accommodationType = z.enum(['tent', 'freeShelter', 'mountainHut', 'paidAccommodation'])

export const hikeDetailsSchema = z.object({
  direction: z.enum(['northbound', 'southbound', 'eastbound', 'westbound']).nullable(),
  stages: z
    .object({ start: z.number().int().positive(), end: z.number().int().positive() })
    .nullable(),
  thruHike: z.boolean(),
  achievements: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('distance'), kilometers: z.number().int().positive() }),
        z.object({ type: z.literal('arcticCircle') }),
      ]),
    )
    .default([]),
  overnights: z.array(z.object({ type: accommodationType, count: z.number().int().nonnegative() })),
})

export const trailDetailsSchema = z.object({
  hikingMonths: z.array(z.number().int().min(1).max(12)),
  waterSources: z.array(z.enum(['tap', 'shop', 'natural'])),
  overnightOptions: z.array(accommodationType),
  overnightRestrictions: z.array(
    z.enum(['campingRestrictions', 'bookingRequired', 'feesMayApply']),
  ),
})

export type AccommodationType = z.infer<typeof accommodationType>
export type HikeDetails = z.infer<typeof hikeDetailsSchema>
export type TrailDetails = z.infer<typeof trailDetailsSchema>
