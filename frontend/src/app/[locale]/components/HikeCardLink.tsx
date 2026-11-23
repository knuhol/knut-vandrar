'use client'

import type { ReactNode } from 'react'
import { preload } from 'react-dom'

import { coverImageUrl, imageUrl } from '@/api/images'
import { ButtonLink } from '@/components/Button'
import { responsiveMedia } from '@/config/breakpoints'

export function HikeCardLink({
  slug,
  coverUrl,
  label,
  children,
}: {
  slug: string
  coverUrl?: string | null
  label: string
  children: ReactNode
}) {
  function prefetchCover() {
    if (!coverUrl) {
      return
    }

    const source = window.matchMedia(responsiveMedia.belowDesktop).matches
      ? coverImageUrl(coverUrl, 'mobile')
      : imageUrl(coverUrl)
    preload(source, { as: 'image', fetchPriority: 'low' })
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
