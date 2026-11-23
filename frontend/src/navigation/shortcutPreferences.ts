'use client'

import { useSyncExternalStore } from 'react'

const storageKey = 'character-shortcuts'
const subscribers = new Set<() => void>()
let temporaryPreference: boolean | undefined

function isEnabled() {
  try {
    return temporaryPreference ?? window.localStorage.getItem(storageKey) !== 'off'
  } catch {
    return temporaryPreference ?? true
  }
}

function subscribe(update: () => void) {
  function sync(event: StorageEvent) {
    if (event.key === null || event.key === storageKey) {
      update()
    }
  }
  subscribers.add(update)
  window.addEventListener('storage', sync)
  return () => {
    subscribers.delete(update)
    window.removeEventListener('storage', sync)
  }
}

export function setCharacterShortcutsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(storageKey, enabled ? 'on' : 'off')
    temporaryPreference = undefined
  } catch {
    temporaryPreference = enabled
  }
  for (const update of subscribers) {
    update()
  }
}

export function useCharacterShortcutsEnabled() {
  return useSyncExternalStore(subscribe, isEnabled, () => true)
}
