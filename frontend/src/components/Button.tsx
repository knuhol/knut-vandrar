'use client'

import type { ComponentProps } from 'react'

import type { UIComponentProps } from './uiComponentProps'

import { handleSectionLinkClick } from '@/navigation/sectionLink'
import { Link } from '@/i18n/navigation'

const variants = {
  secondary: 'bg-forest text-cream hover:bg-forest-dark focus-visible:bg-forest-dark',
  primary: 'bg-orange text-ink hover:bg-orange-dark focus-visible:bg-orange-dark',
  tertial:
    'bg-transparent border-2 border-forest text-forest hover:text-forest-dark hover:border-forest-dark focus-visible:bg-forest',
  secondaryInverted: 'bg-cream text-forest hover:bg-beige focus-visible:bg-beige',
}

const sizes = {
  extraSmall: 'min-h-6 px-2 py-0.5 gap-1.5 text-sm',
  small: 'min-h-10 px-4 py-2 gap-3 text-base',
  medium: 'min-h-13 px-5.75 py-3.25 gap-3 text-lg',
  large: 'min-h-16 px-7 py-4 gap-3 text-xl',
}

type ButtonOptions = {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

function buttonClasses(variant: keyof typeof variants, size: keyof typeof sizes) {
  return `inline-flex cursor-pointer items-center justify-center rounded-sm font-semibold disabled:cursor-default disabled:opacity-40 ${variants[variant]} ${sizes[size]}`
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
