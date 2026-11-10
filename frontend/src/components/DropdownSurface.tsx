'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import type { ComponentProps } from 'react'

export function DropdownSurface({
  className = '',
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        {...props}
        className={`z-50 min-w-40 rounded-menu border border-line bg-paper p-1.75 shadow-menu [&_a]:block [&_a]:rounded-item [&_a]:px-3.5 [&_a]:py-2 [&_a]:text-copy [&_a[data-highlighted]]:bg-cream [&_a[data-highlighted]]:outline-none [&_a[aria-current]]:font-bold [&_a[aria-current]]:text-forest ${className}`}
      />
    </DropdownMenu.Portal>
  )
}
