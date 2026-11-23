'use client'

import { useEffect } from 'react'

import type { CoverSources } from '@/api/images'
import { prefetchHikeCover } from '@/hiking/prefetchCovers'

export function HomeCoverPrefetch({ covers }: { covers: CoverSources[] }) {
  useEffect(() => {
    for (const cover of covers) {
      void prefetchHikeCover(cover)
    }
  }, [covers])

  return null
}
