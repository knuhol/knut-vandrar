'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

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
  const [active, setActive] = useState(false)
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const value = useMemo(
    () => ({ active, setActive, siteMenuOpen, setSiteMenuOpen, slot, setSlot }),
    [active, siteMenuOpen, slot],
  )

  return <ReadingNavigationContext value={value}>{children}</ReadingNavigationContext>
}

export function useReadingNavigation() {
  return useContext(ReadingNavigationContext)
}
