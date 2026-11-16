import { useFormatter } from 'next-intl'

import type { ReactNode } from 'react'

export function FactItems({
  items,
}: {
  items: { id: string; label: string; icon: ReactNode; count?: number }[]
}) {
  const format = useFormatter()

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="inline-flex max-w-full items-center gap-2 rounded-sm border border-beige bg-paper px-3 py-2 text-sm text-forest"
        >
          {item.count !== undefined && (
            <span className="shrink-0 font-sans text-sm leading-tight font-semibold tabular-nums whitespace-nowrap">
              {format.number(item.count)}×
            </span>
          )}
          <span className="shrink-0 [&_svg]:size-5" aria-hidden="true">
            {item.icon}
          </span>
          <span className="min-w-0 wrap-anywhere">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
