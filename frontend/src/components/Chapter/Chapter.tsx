'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

import { chapterExpansionEvent } from './chapterState'

import { cancelPageScroll, motionDuration, scrollToElement } from '@/navigation/motion'

export function Chapter({ children }: { children?: ReactNode }) {
  const element = useRef<HTMLDetailsElement>(null)
  const id = useId()

  useEffect(() => {
    const details = element.current
    const summary = details?.querySelector('summary')
    if (!details || !summary) {
      return
    }
    let animation: Animation | null = null
    let expanded = details.open
    let operation = 0
    let pending = false
    details.dataset.expanded = String(expanded)

    function toggle(event: MouseEvent) {
      if (
        !details ||
        !summary ||
        (event.target instanceof Element && event.target.closest('a, button, input'))
      ) {
        return
      }
      event.preventDefault()
      cancelPageScroll()
      const summaryTop = summary.getBoundingClientRect().top
      const wasSticky =
        expanded &&
        summaryTop < Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)
      const article = details
      const request = ++operation
      const start = details.getBoundingClientRect().height
      animation?.cancel()
      expanded = !expanded
      pending = false

      function animate(startHeight: number) {
        if (!details || !summary || request !== operation) {
          return
        }
        pending = false
        details.open = true
        const style = getComputedStyle(details)
        const border =
          Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)
        const end = expanded
          ? details.getBoundingClientRect().height
          : summary.getBoundingClientRect().height + border
        function finish() {
          if (!details || request !== operation) {
            return
          }
          details.open = expanded
          animation = null
        }
        const duration = motionDuration(details)
        summary.style.setProperty('--chapter-toggle-duration', `${String(duration)}ms`)
        details.dataset.expanded = String(expanded)
        if (duration === 0) {
          finish()
          return
        }
        animation = details.animate(
          [{ height: `${String(startHeight)}px` }, { height: `${String(end)}px` }],
          { duration, easing: 'ease-out' },
        )
        animation.onfinish = finish
      }
      if (!expanded && wasSticky) {
        pending = true
        async function closeAfterScroll(target: HTMLElement) {
          const completed = await scrollToElement(target)
          if (request !== operation || !details) {
            return
          }
          pending = false
          if (completed) {
            animate(details.getBoundingClientRect().height)
          } else {
            expanded = details.open
            details.dataset.expanded = String(expanded)
          }
        }
        void closeAfterScroll(article)
      } else {
        animate(start)
      }
    }

    function pointerDown(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest('a, button, input'))
      ) {
        return
      }
      // Taking focus must not move the reader away from the current position.
      event.preventDefault()
      summary?.focus({ preventScroll: true })
    }
    function sync() {
      if (!animation && !pending && details) {
        expanded = details.open
        details.dataset.expanded = String(expanded)
      }
    }
    function expandFromControl(event: Event) {
      const next = (event as CustomEvent<unknown>).detail
      if (!details || typeof next !== 'boolean') {
        return
      }
      operation += 1
      animation?.cancel()
      animation = null
      if (pending) {
        cancelPageScroll()
      }
      pending = false
      expanded = next
      details.dataset.expanded = String(next)
      details.open = next
    }
    details.addEventListener(chapterExpansionEvent, expandFromControl)
    summary.addEventListener('mousedown', pointerDown)
    summary.addEventListener('click', toggle)
    details.addEventListener('toggle', sync)
    return () => {
      operation += 1
      if (pending) {
        cancelPageScroll()
      }
      animation?.cancel()
      summary.removeEventListener('mousedown', pointerDown)
      summary.removeEventListener('click', toggle)
      details.removeEventListener('toggle', sync)
      details.removeEventListener(chapterExpansionEvent, expandFromControl)
    }
  }, [])

  return (
    <details ref={element} id={`chapter-${id}`} data-chapter>
      {children}
    </details>
  )
}
