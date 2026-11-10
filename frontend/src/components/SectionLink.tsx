'use client'

import Link from 'next/link'

import type { ComponentProps } from 'react'

// Next.js can skip scrolling when the current URL already has the same hash.

export function SectionLink({ href, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        props.onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== '_self')
        )
          return

        const destination = new URL(event.currentTarget.href)
        if (
          destination.origin !== window.location.origin ||
          destination.pathname !== window.location.pathname ||
          destination.search !== window.location.search ||
          !destination.hash
        )
          return

        const section = document.getElementById(decodeURIComponent(destination.hash.slice(1)))
        if (!section) return
        event.preventDefault()
        if (window.location.hash !== destination.hash)
          window.history.pushState(null, '', destination.href)
        section.focus({ preventScroll: true })
        section.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        })
      }}
    >
      {children}
    </Link>
  )
}
