'use client'

import type { ComponentProps } from 'react'

import type { UIComponentProps } from './uiComponentProps'

import { handleSectionLinkClick } from '@/navigation/sectionLink'
import { Link } from '@/i18n/navigation'

const pillClasses =
  'inline-flex cursor-pointer items-center justify-center gap-3 rounded-full border border-beige bg-transparent px-3.5 py-1.5 text-sm aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-cream disabled:cursor-default disabled:opacity-40'

export function Pill({ type = 'button', ...props }: UIComponentProps<ComponentProps<'button'>>) {
  return <button {...props} type={type} className={pillClasses} />
}

export function PillLink({ onClick, ...props }: UIComponentProps<ComponentProps<typeof Link>>) {
  return (
    <Link
      {...props}
      data-link-kind="pill"
      className={pillClasses}
      onClick={(event) => {
        onClick?.(event)
        handleSectionLinkClick(event)
      }}
    />
  )
}
