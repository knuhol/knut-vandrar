'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { cancelPageScroll, motionDuration, scrollToElement } from '@/navigation/motion'

export function Chapter({ children }: { children?: ReactNode }) {
  const element = useRef<HTMLDetailsElement>(null)

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
      const summaryStyle = getComputedStyle(summary)
      const summaryTop = summary.getBoundingClientRect().top
      const wasSticky =
        expanded &&
        summaryStyle.position === 'sticky' &&
        Math.abs(summaryTop - Number.parseFloat(summaryStyle.top)) <= 1 &&
        details.getBoundingClientRect().top < summaryTop - 1
      const article = details.closest('article')
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
      if (!expanded && wasSticky && article) {
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
      // Focusing a sticky summary must not scroll its original flow position into view.
      event.preventDefault()
      summary?.focus({ preventScroll: true })
    }
    function sync() {
      if (!animation && !pending && details) {
        expanded = details.open
      }
    }
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
    }
  }, [])

  return <details ref={element}>{children}</details>
}
