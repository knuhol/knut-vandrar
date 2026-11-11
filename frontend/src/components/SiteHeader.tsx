'use client'

import { useEffect, useRef } from 'react'

import type { ReactNode } from 'react'

import type { UIComponentProps } from './uiComponentProps'

export function SiteHeader({ children }: UIComponentProps<{ children: ReactNode }>) {
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = header.current

    if (!element) {
      return
    }

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
      className="sticky top-0 z-40 border-b border-beige bg-cream shadow-sm"
    >
      {children}
    </header>
  )
}
