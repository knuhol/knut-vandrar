'use client'

import { useCallback, useEffect, useRef } from 'react'

import { allowsPageShortcut } from './keyboardShortcuts'
import { useCharacterShortcutsEnabled } from './shortcutPreferences'

type ShortcutOptions = {
  enabled?: boolean
  sectionId?: string
}

export function usePageShortcut(
  key: string,
  run: () => boolean | void,
  { enabled = true, sectionId }: ShortcutOptions = {},
) {
  const characterShortcutsEnabled = useCharacterShortcutsEnabled()

  useEffect(() => {
    if (!enabled || (key.length === 1 && !characterShortcutsEnabled)) {
      return
    }

    function activate(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key || !allowsPageShortcut(event)) {
        return
      }

      if (sectionId) {
        const section = document.getElementById(sectionId)
        if (!section) {
          return
        }
        const bounds = section.getBoundingClientRect()
        const readingLine =
          Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
        if (
          !section.contains(document.activeElement) &&
          (bounds.top > readingLine + 1 || bounds.bottom <= readingLine)
        ) {
          return
        }
      }

      if (run() !== false) {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', activate)
    return () => {
      window.removeEventListener('keydown', activate)
    }
  }, [characterShortcutsEnabled, enabled, key, run, sectionId])
}

export function useClickShortcut<T extends HTMLElement>(key: string, options?: ShortcutOptions) {
  const element = useRef<T>(null)
  const click = useCallback(() => {
    if (!element.current) {
      return false
    }
    element.current.click()
  }, [])
  usePageShortcut(key, click, options)
  return element
}
