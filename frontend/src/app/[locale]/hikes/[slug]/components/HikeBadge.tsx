import type { ReactNode } from 'react'

export function HikeBadge({
  children,
  kind,
}: {
  children: ReactNode
  kind: 'milestone' | 'characteristic' | 'country'
}) {
  const appearance = {
    milestone: 'rounded-sm border-orange-outline bg-cream',
    characteristic: 'rounded-sm border-forest-outline bg-forest/10',
    country: 'rounded-full border-forest-outline bg-paper',
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 border px-3 py-2 text-sm font-semibold text-forest ${appearance[kind]}`}
    >
      {children}
    </span>
  )
}
