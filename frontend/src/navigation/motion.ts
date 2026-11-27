export function motionDuration(element: Element, token = '--duration-motion') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 0
  }
  const value = getComputedStyle(element).getPropertyValue(token).trim()
  const duration = Number.parseFloat(value)
  // CSS optimizers may normalize 300ms to .3s; Web Animations expects milliseconds.
  return Number.isFinite(duration) ? duration * (value.endsWith('ms') ? 1 : 1000) : 0
}

let scrollFrame = 0
let completeScroll: ((completed: boolean) => void) | undefined
let anchorScrollTarget: HTMLElement | null = null
const anchorScrollListeners = new Set<() => void>()

function setAnchorScrollTarget(target: HTMLElement | null) {
  if (anchorScrollTarget === target) {
    return
  }
  anchorScrollTarget = target
  for (const listener of anchorScrollListeners) {
    listener()
  }
}

export function getAnchorScrollTarget() {
  return anchorScrollTarget
}

export function subscribeAnchorScroll(listener: () => void) {
  anchorScrollListeners.add(listener)
  return () => {
    anchorScrollListeners.delete(listener)
  }
}

export function cancelPageScroll() {
  cancelAnimationFrame(scrollFrame)
  completeScroll?.(false)
  completeScroll = undefined
  setAnchorScrollTarget(null)
}

export function scrollAlignmentOffset(
  element: HTMLElement,
  pagePadding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
) {
  // Explicit margins align full-bleed sections to the header instead of the reading gap.
  return Number.parseFloat(getComputedStyle(element).scrollMarginTop) || pagePadding
}

export function scrollToElement(
  element: HTMLElement,
  { anchor = false }: { anchor?: boolean } = {},
) {
  cancelPageScroll()
  const start = window.scrollY
  let target: number | undefined
  const duration = motionDuration(element)
  const started = performance.now()
  return new Promise<boolean>((resolve) => {
    completeScroll = resolve
    if (anchor) {
      setAnchorScrollTarget(element)
    }
    function step(now: number) {
      // Measure after menus close and keep anchor destinations aligned during layout changes.
      if (anchor || target === undefined) {
        target = Math.max(
          0,
          Math.min(
            window.scrollY + element.getBoundingClientRect().top - scrollAlignmentOffset(element),
            document.documentElement.scrollHeight - window.innerHeight,
          ),
        )
      }
      const progress = duration === 0 ? 1 : Math.min((now - started) / duration, 1)
      window.scrollTo({
        top: start + (target - start) * (1 - (1 - progress) ** 3),
        behavior: 'instant',
      })
      if (progress < 1) {
        scrollFrame = requestAnimationFrame(step)
      } else {
        completeScroll = undefined
        setAnchorScrollTarget(null)
        resolve(true)
      }
    }
    scrollFrame = requestAnimationFrame(step)
  })
}
