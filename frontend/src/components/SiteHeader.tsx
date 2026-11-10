'use client'

import { useEffect, useRef } from 'react'

import type { ReactNode } from 'react'

export function SiteHeader({ children }: { children: ReactNode }) {
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = header.current
    if (!element) return
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--header-height',
        `${String(element.getBoundingClientRect().height)}px`,
      )
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <header
      ref={header}
      data-site-header
      className="sticky top-0 z-40 border-b border-line bg-cream shadow-header"
    >
      {children}
    </header>
  )
}
