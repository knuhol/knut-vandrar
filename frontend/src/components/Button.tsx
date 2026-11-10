import type { ComponentProps } from 'react'

import { SectionLink } from './SectionLink'

const variants = {
  primary: 'rounded-button bg-forest px-5.75 py-3.25 font-semibold text-white hover:bg-forest-dark',
  accent: 'rounded-button bg-orange px-5.75 py-3.25 font-semibold text-ink hover:bg-orange-dark',
  pill: 'rounded-pill border border-pill-border bg-transparent px-3.5 py-1.5 text-pill aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-white',
}

function buttonClasses(variant: keyof typeof variants, className: string) {
  return `inline-flex cursor-pointer items-center justify-center gap-3 disabled:cursor-default disabled:opacity-40 ${variants[variant]} ${className}`
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof variants }) {
  return <button {...props} type={type} className={buttonClasses(variant, className)} />
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof SectionLink> & { variant?: keyof typeof variants }) {
  return <SectionLink {...props} className={buttonClasses(variant, className)} />
}
