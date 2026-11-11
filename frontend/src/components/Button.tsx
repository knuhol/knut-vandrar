'use client'

import type { ComponentProps } from 'react'

import type { UIComponentProps } from './uiComponentProps'

import { handleSectionLinkClick } from '@/navigation/sectionLink'
import { Link } from '@/i18n/navigation'

const variants = {
  secondary: 'bg-forest text-cream hover:bg-ink focus-visible:bg-ink',
  primary:
    'bg-orange text-ink hover:bg-orange-dark focus-visible:bg-orange-dark focus-visible:outline-[calc(var(--spacing)*0.75)] focus-visible:outline-offset-[var(--spacing)] focus-visible:outline-orange',
}

const sizes = {
  small: 'min-h-10 px-4 py-2 text-base',
  medium: 'min-h-13 px-5.75 py-3.25 text-lg',
  large: 'min-h-16 px-7 py-4 text-xl',
}

type ButtonOptions = {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

function buttonClasses(variant: keyof typeof variants, size: keyof typeof sizes) {
  return `inline-flex cursor-pointer items-center justify-center gap-3 rounded-sm font-semibold disabled:cursor-default disabled:opacity-40 ${variants[variant]} ${sizes[size]}`
}

export function Button({
  variant = 'primary',
  size = 'medium',
  type = 'button',
  ...props
}: UIComponentProps<ComponentProps<'button'>> & ButtonOptions) {
  return <button {...props} type={type} className={buttonClasses(variant, size)} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'medium',
  stretched = false,
  ...props
}: UIComponentProps<ComponentProps<typeof Link>> & ButtonOptions & { stretched?: boolean }) {
  return (
    <Link
      {...props}
      data-link-kind="button"
      className={`${buttonClasses(variant, size)} ${stretched ? 'after:absolute after:inset-0 after:z-10' : ''}`}
      onClick={(event) => {
        props.onClick?.(event)
        handleSectionLinkClick(event)
      }}
    />
  )
}
