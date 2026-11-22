import type { ReactNode } from 'react'

export function FactTag({
  children,
  state = 'default',
  size = 'default',
}: {
  children: ReactNode
  state?: 'default' | 'selected' | 'muted'
  size?: 'default' | 'month'
}) {
  return (
    <span
      className={`inline-flex max-w-full items-start gap-2 rounded-sm border text-sm ${size === 'month' ? 'w-full justify-center px-1 py-2 text-xs' : 'px-3 py-2'} ${state === 'selected' ? 'border-forest bg-forest font-semibold text-cream' : state === 'muted' ? 'border-forest-outline bg-transparent text-muted' : 'border-forest-outline bg-paper text-forest'}`}
    >
      {children}
    </span>
  )
}
