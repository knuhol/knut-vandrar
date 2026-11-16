'use client'

import { useEffect } from 'react'

import { motionDuration } from '@/navigation/motion'

export function ImageMotion() {
  useEffect(() => {
    function reveal(event: Event) {
      const image = event.target
      if (
        !(image instanceof HTMLImageElement) ||
        !image.naturalWidth ||
        typeof image.animate !== 'function'
      ) {
        return
      }
      const duration = motionDuration(image, '--duration-image-reveal')
      if (duration > 0) {
        image.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' })
      }
    }
    // Capturing also covers lazy images and galleries mounted after navigation.
    document.addEventListener('load', reveal, true)
    return () => {
      document.removeEventListener('load', reveal, true)
    }
  }, [])

  return null
}
