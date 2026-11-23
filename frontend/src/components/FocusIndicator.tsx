'use client'

import { useEffect } from 'react'

export function FocusIndicator() {
  useEffect(() => {
    const root = document.documentElement

    function trackPointer(event: PointerEvent) {
      root.toggleAttribute('data-touch-input', event.pointerType === 'touch')
    }

    function trackKeyboard() {
      delete root.dataset.touchInput
    }

    document.addEventListener('pointerdown', trackPointer, { capture: true, passive: true })
    document.addEventListener('keydown', trackKeyboard, true)

    return () => {
      document.removeEventListener('pointerdown', trackPointer, true)
      document.removeEventListener('keydown', trackKeyboard, true)
      delete root.dataset.touchInput
    }
  }, [])

  return null
}
