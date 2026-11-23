'use client'

import type { ReactNode } from 'react'
import { preload } from 'react-dom'

import type { CoverSources } from '@/api/images'
import { ButtonLink } from '@/components/Button'
import { responsiveMedia } from '@/config/breakpoints'

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
    // On phones the page uses the same image already loaded by the card.
    if (!covers || window.matchMedia(responsiveMedia.belowTablet).matches) {
      return
    }

    preload(covers.mobile, { as: 'image', fetchPriority: 'low' })
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
