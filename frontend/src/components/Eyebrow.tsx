import type { ReactNode } from 'react'

export function Eyebrow({
  children,
  tone = 'brand',
}: {
  children: ReactNode
  tone?: 'brand' | 'inverse'
}) {
  return (
    <p
      className={`flex items-center gap-3 font-statistic text-xs font-bold tracking-widest uppercase ${tone === 'inverse' ? 'text-cream' : 'text-forest'}`}
    >
      <span aria-hidden="true" className="h-0.5 w-8 shrink-0 bg-orange" />
      <span>{children}</span>
    </p>
  )
}
