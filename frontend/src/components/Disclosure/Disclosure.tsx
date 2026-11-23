'use client'

import type { ReactNode } from 'react'

import { useDisclosure } from './useDisclosure'

export function Disclosure({ children }: { children: ReactNode }) {
  const element = useDisclosure()

  return (
    <details ref={element} className="overflow-clip [&>summary]:focus-inset">
      {children}
    </details>
  )
}
