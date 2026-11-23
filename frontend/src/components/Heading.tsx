import type { ComponentProps, ReactNode } from 'react'

import type { UIComponentProps } from './uiComponentProps'

type TextSizeClass =
  'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-3xl' | 'text-4xl' | 'text-6xl'

const defaults = { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-xl' } as const

export function Heading({
  as: Tag = 'h1',
  className = defaults[Tag],
  tone = 'default',
  eyebrow,
  ...props
}: Omit<UIComponentProps<ComponentProps<'h1'>>, 'className'> & {
  as?: keyof typeof defaults
  className?: TextSizeClass
  tone?: 'default' | 'brand' | 'inverse'
  eyebrow?: ReactNode
}) {
  const heading = (
    <Tag
      {...props}
      className={`font-display leading-tight font-bold tracking-tight ${className} ${tone === 'brand' ? 'text-forest' : ''} ${tone === 'inverse' ? 'text-cream' : ''}`}
    />
  )

  if (eyebrow == null || eyebrow === false) {
    return heading
  }

  const inverse = tone === 'inverse'

  return (
    <div className="flex flex-col gap-1">
      <p
        className={`flex items-center gap-3 font-statistic text-xs font-bold tracking-widest uppercase ${inverse ? 'text-cream' : 'text-forest'}`}
      >
        <span
          aria-hidden="true"
          className={`h-0.5 w-8 shrink-0 bg-orange ${inverse ? 'shadow-(--shadow-badge-on-image)' : ''}`}
        />
        <span>{eyebrow}</span>
      </p>
      {heading}
    </div>
  )
}
