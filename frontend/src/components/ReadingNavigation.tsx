'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ReadingNavigationState = {
  active: boolean
  setActive: (active: boolean) => void
  siteMenuOpen: boolean
  setSiteMenuOpen: (open: boolean) => void
  slot: HTMLDivElement | null
  setSlot: (slot: HTMLDivElement | null) => void
}

const ReadingNavigationContext = createContext<ReadingNavigationState>({
  active: false,
  setActive: () => undefined,
  siteMenuOpen: false,
  setSiteMenuOpen: () => undefined,
  slot: null,
  setSlot: () => undefined,
})

export function ReadingNavigationProvider({ children }: { children: ReactNode }) {
  const [active, setReadingActive] = useState(false)
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const setActive = useCallback((next: boolean) => {
    setReadingActive(next)
    if (!next) {
      setSiteMenuOpen(false)
    }
  }, [])
  const value = useMemo(
    () => ({ active, setActive, siteMenuOpen, setSiteMenuOpen, slot, setSlot }),
    [active, setActive, siteMenuOpen, slot],
  )

  return <ReadingNavigationContext value={value}>{children}</ReadingNavigationContext>
}

export function useReadingNavigation() {
  return useContext(ReadingNavigationContext)
}
