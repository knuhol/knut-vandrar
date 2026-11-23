import type { ReactNode } from 'react'

export function FactTag({
  children,
  state = 'default',
  size = 'default',
  kind = 'fact',
}: {
  children: ReactNode
  state?: 'default' | 'selected' | 'muted'
  size?: 'default' | 'month'
  kind?: 'fact' | 'milestone' | 'characteristic' | 'country'
}) {
  const appearance = {
    fact:
      state === 'selected'
        ? 'border-forest bg-forest font-semibold text-cream'
        : state === 'muted'
          ? 'border-forest-outline bg-transparent text-muted'
          : 'border-forest-outline bg-paper text-forest',
    milestone: 'border-orange-outline bg-cream font-semibold text-forest',
    characteristic: 'border-forest-outline bg-forest/10 font-semibold text-forest',
    country: 'border-forest-outline bg-paper font-semibold text-forest',
  }

  return (
    <span
      className={`inline-flex max-w-full gap-2 border text-sm ${kind === 'fact' || kind === 'milestone' ? 'items-start' : 'items-center'} ${kind === 'country' ? 'rounded-full' : 'rounded-sm'} ${size === 'month' ? 'w-full justify-center px-1 py-2 text-xs' : 'px-3 py-2'} ${appearance[kind]}`}
    >
      {children}
    </span>
  )
}
