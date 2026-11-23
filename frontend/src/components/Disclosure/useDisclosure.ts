'use client'

import { useEffect, useRef } from 'react'

import { disclosureExpansionEvent } from './disclosureState'

import { cancelPageScroll, motionDuration, scrollToElement } from '@/navigation/motion'

export function useDisclosure({ scrollBeforeClosing = false, blurOnPointerClose = false } = {}) {
  const element = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const details = element.current
    const summary = details?.querySelector('summary')
    if (!details || !summary) {
      return
    }
    const arrow = summary.querySelector<HTMLElement>('[data-disclosure-arrow]')
    let animation: Animation | null = null
    let arrowAnimation: Animation | undefined
    let expanded = details.open
    let operation = 0
    let pending = false
    details.dataset.expanded = String(expanded)

    function setExpanded(next: boolean, { fromSummary = false, blurAfterClose = false } = {}) {
      if (!details || !summary || next === expanded) {
        return
      }
      const shouldScroll =
        fromSummary &&
        scrollBeforeClosing &&
        !next &&
        summary.getBoundingClientRect().top <
          Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)
      if (pending || (fromSummary && scrollBeforeClosing)) {
        cancelPageScroll()
      }
      const request = ++operation
      const start = details.getBoundingClientRect().height
      animation?.cancel()
      animation = null
      expanded = next
      pending = false

      function animate(startHeight: number) {
        if (!details || !summary || request !== operation) {
          return
        }
        pending = false
        details.open = true
        const style = getComputedStyle(details)
        const border =
          (Number.parseFloat(style.borderTopWidth) || 0) +
          (Number.parseFloat(style.borderBottomWidth) || 0)
        const end = expanded
          ? details.getBoundingClientRect().height
          : summary.getBoundingClientRect().height + border
        function finish() {
          if (!details || request !== operation) {
            return
          }
          details.open = expanded
          animation = null
          if (!expanded && blurAfterClose) {
            summary?.blur()
          }
        }
        const duration = motionDuration(details)
        const arrowStart = arrow && getComputedStyle(arrow).transform
        arrowAnimation?.cancel()
        details.dataset.expanded = String(expanded)
        if (duration === 0) {
          finish()
          return
        }
        const timing = { duration, easing: 'ease-out', fill: 'backwards' } as const
        animation = details.animate(
          [{ height: `${String(startHeight)}px` }, { height: `${String(end)}px` }],
          timing,
        )
        arrowAnimation = arrow?.animate(
          [{ transform: arrowStart || 'none' }, { transform: expanded ? 'rotate(90deg)' : 'none' }],
          timing,
        )
        animation.onfinish = finish
        const motions = arrowAnimation ? [animation, arrowAnimation] : [animation]
        // Paint the initial height before playing, after bulk toggles have finished measuring.
        for (const motion of motions) {
          motion.pause()
          motion.currentTime = 0
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (request === operation) {
              for (const motion of motions) {
                motion.play()
              }
            }
          })
        })
      }
      if (shouldScroll) {
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
        void closeAfterScroll(details)
      } else {
        animate(start)
      }
    }

    function toggle(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest('a, button, input')) {
        return
      }
      event.preventDefault()
      setExpanded(!expanded, {
        fromSummary: true,
        blurAfterClose: blurOnPointerClose && event.detail > 0,
      })
    }

    function pointerDown(event: MouseEvent) {
      if (
        !scrollBeforeClosing ||
        event.button !== 0 ||
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest('a, button, input'))
      ) {
        return
      }
      // Prevent the browser from scrolling a sticky chapter heading into view.
      event.preventDefault()
    }
    function sync() {
      if (!animation && !pending && details) {
        expanded = details.open
        details.dataset.expanded = String(expanded)
      }
    }
    function expandFromControl(event: Event) {
      const next = (event as CustomEvent<unknown>).detail
      if (typeof next === 'boolean') {
        setExpanded(next)
      }
    }
    details.addEventListener(disclosureExpansionEvent, expandFromControl)
    summary.addEventListener('mousedown', pointerDown)
    summary.addEventListener('click', toggle)
    details.addEventListener('toggle', sync)
    return () => {
      operation += 1
      if (pending) {
        cancelPageScroll()
      }
      animation?.cancel()
      arrowAnimation?.cancel()
      summary.removeEventListener('mousedown', pointerDown)
      summary.removeEventListener('click', toggle)
      details.removeEventListener('toggle', sync)
      details.removeEventListener(disclosureExpansionEvent, expandFromControl)
    }
  }, [blurOnPointerClose, scrollBeforeClosing])

  return element
}
