'use client'

import type { ComponentProps } from 'react'

import type { UIComponentProps } from './uiComponentProps'

import { handleSectionLinkClick } from '@/navigation/sectionLink'
import { Link } from '@/i18n/navigation'

export function SectionLink({
  href,
  children,
  ...props
}: UIComponentProps<ComponentProps<typeof Link>>) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        props.onClick?.(event)
        handleSectionLinkClick(event)
      }}
    >
      {children}
    </Link>
  )
}
