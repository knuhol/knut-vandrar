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
          <span className="shrink-0 [&_svg]:size-5" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
          {item.count !== undefined && (
            <span className="font-statistic font-semibold">{format.number(item.count)}×</span>
          )}
        </li>
      ))}
    </ul>
  )
}
