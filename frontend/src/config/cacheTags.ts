export const cacheTags = {
  hikes: 'hikes',
} as const

export type CacheTag = (typeof cacheTags)[keyof typeof cacheTags]

export const cacheRevalidateSeconds = 86_400
