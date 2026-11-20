export const hikeCategories = [
  {
    key: 'long_distance',
    id: 'long-distance-hikes',
    title: 'longDistanceHikes',
    offsetKey: 'offset',
  },
  { key: 'multi_day', id: 'multi-day-hikes', title: 'multiDayHikes', offsetKey: 'multiDayOffset' },
] as const

export type HikeCategory = (typeof hikeCategories)[number]['key']
