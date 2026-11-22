'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import type { ComponentProps } from 'react'

import type { UIComponentProps } from './uiComponentProps'

export function DropdownSurface({
  ...props
}: UIComponentProps<ComponentProps<typeof DropdownMenu.Content>>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        {...props}
        className="z-50 min-w-40 max-w-[calc(100vw-var(--spacing)*8)] rounded-lg border border-beige bg-paper p-1.75 shadow-lg"
      />
    </DropdownMenu.Portal>
  )
}
