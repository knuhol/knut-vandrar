'use client'

import type { ReactNode } from 'react'

import type { CoverSources } from '@/api/images'
import { ButtonLink } from '@/components/Button'
import { prefetchHikeCover } from '@/hiking/prefetchCovers'

export function HikeCardLink({
  slug,
  covers,
  label,
  children,
}: {
  slug: string
  covers: CoverSources | null
  label: string
  children: ReactNode
}) {
  function prefetchCover() {
    if (covers) {
      void prefetchHikeCover(covers, 'high')
    }
  }

  return (
    <ButtonLink
      size="small"
      stretched
      href={{ pathname: '/hikes/[slug]', params: { slug } }}
      aria-label={label}
      onPointerEnter={prefetchCover}
      onFocus={prefetchCover}
    >
      {children}
    </ButtonLink>
  )
}
