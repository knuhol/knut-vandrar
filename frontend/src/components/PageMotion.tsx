'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import {
  handleAnchorClick,
  handleSectionPointerDown,
  sectionForHash,
} from '@/navigation/sectionLink'
import { cancelPageScroll, scrollToElement } from '@/navigation/motion'

export function PageMotion() {
  const pathname = usePathname()

  useEffect(() => {
    function click(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (anchor instanceof HTMLAnchorElement) {
        handleAnchorClick(event, anchor)
      }
    }
    function pointerDown(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (anchor instanceof HTMLAnchorElement) {
        handleSectionPointerDown(event, anchor)
      }
    }
    function hashChange() {
      const element = sectionForHash(window.location.hash)
      if (element) {
        void scrollToElement(element, { anchor: true })
      }
    }
    const frame = requestAnimationFrame(hashChange)
    document.addEventListener('mousedown', pointerDown, true)
    // Let controls (including dropdown items) finish selection before canceling
    // the browser's anchor jump. Capture would prevent their default close action.
    document.addEventListener('click', click)
    window.addEventListener('hashchange', hashChange)
    window.addEventListener('wheel', cancelPageScroll, { passive: true })
    window.addEventListener('touchstart', cancelPageScroll, { passive: true })
    window.addEventListener('keydown', cancelPageScroll)
    return () => {
      cancelAnimationFrame(frame)
      cancelPageScroll()
      document.removeEventListener('mousedown', pointerDown, true)
      document.removeEventListener('click', click)
      window.removeEventListener('hashchange', hashChange)
      window.removeEventListener('wheel', cancelPageScroll)
      window.removeEventListener('touchstart', cancelPageScroll)
      window.removeEventListener('keydown', cancelPageScroll)
    }
  }, [pathname])

  return null
}
