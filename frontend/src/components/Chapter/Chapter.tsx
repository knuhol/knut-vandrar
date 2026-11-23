'use client'

import { useId, type ReactNode } from 'react'

import { useDisclosure } from '../Disclosure/useDisclosure'

export function Chapter({ children }: { children?: ReactNode }) {
  const element = useDisclosure({ scrollBeforeClosing: true })
  const id = useId()

  return (
    <details ref={element} id={`chapter-${id}`} data-chapter>
      {children}
    </details>
  )
}
