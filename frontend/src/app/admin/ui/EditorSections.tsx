'use client'

import { createContext, useContext, useRef, useState } from 'react'

interface SectionState {
  expandedId: string | null
  toggle: (id: string, expanded: boolean) => void
  claimInvalid: (id: string) => boolean
  finishValidation: (id: string) => void
}

const SectionsContext = createContext<SectionState | null>(null)

export function EditorSections({ children }: { children: React.ReactNode }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const validating = useRef<string | null>(null)
  return (
    <SectionsContext.Provider
      value={{
        expandedId,
        toggle: (id, expanded) => {
          validating.current = null
          setExpandedId(expanded ? id : null)
        },
        claimInvalid: (id) => {
          if (validating.current === null) {
            validating.current = id
            setExpandedId(id)
          }
          return validating.current === id
        },
        finishValidation: (id) => {
          if (validating.current === id) {
            validating.current = null
          }
        },
      }}
    >
      {children}
    </SectionsContext.Provider>
  )
}

export function useEditorSections() {
  const context = useContext(SectionsContext)
  if (!context) {
    throw new Error('EditorSection requires EditorSections')
  }
  return context
}
