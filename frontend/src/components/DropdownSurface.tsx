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
        className="z-50 min-w-40 rounded-lg border border-beige bg-paper p-1.75 shadow-lg [&_a]:block [&_a]:rounded-sm [&_a]:px-3.5 [&_a]:py-2 [&_a]:text-base [&_a:focus]:outline-none [&_a[aria-current]]:font-bold [&_a[aria-current]]:text-forest [&_a[aria-current]]:underline [&_a[aria-current]]:decoration-orange [&_a[aria-current]]:decoration-3"
      />
    </DropdownMenu.Portal>
  )
}
