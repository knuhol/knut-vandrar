import type { ComponentProps } from 'react'

import type { UIComponentProps } from './uiComponentProps'

type TextSizeClass =
  'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-3xl' | 'text-4xl' | 'text-6xl'

const defaults = { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-xl' } as const

export function Heading({
  as: Tag = 'h1',
  className = defaults[Tag],
  tone = 'default',
  ...props
}: Omit<UIComponentProps<ComponentProps<'h1'>>, 'className'> & {
  as?: keyof typeof defaults
  className?: TextSizeClass
  tone?: 'default' | 'brand'
}) {
  return (
    <Tag
      {...props}
      className={`font-display leading-tight font-bold tracking-tight ${className} ${tone === 'brand' ? 'text-forest' : ''}`}
    />
  )
}
