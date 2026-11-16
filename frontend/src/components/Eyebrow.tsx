import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-statistic text-xs font-bold tracking-widest text-forest uppercase">
      <span aria-hidden="true" className="h-0.5 w-8 shrink-0 bg-orange" />
      <span>{children}</span>
    </p>
  )
}
