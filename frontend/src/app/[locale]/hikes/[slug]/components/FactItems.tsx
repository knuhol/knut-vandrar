import { useFormatter } from 'next-intl'

import type { ReactNode } from 'react'

import { FactTag } from './FactTag'

export function FactItems({
  items,
}: {
  items: {
    id: string
    label: string
    icon: ReactNode
    count?: number
  }[]
}) {
  const format = useFormatter()

  return (
    <ul className="flex flex-wrap items-start gap-2">
      {items.map((item) => (
        <li key={item.id} className="max-w-full">
          <FactTag>
            <span className="flex items-center gap-0.5">
              {item.count !== undefined && (
                <>
                  <span className="shrink-0 font-sans text-base leading-tight font-semibold tabular-nums whitespace-nowrap">
                    {format.number(item.count)}
                  </span>
                  <span className="shrink-0 font-sans text-base leading-tight font-semibold tabular-nums whitespace-nowrap">
                    ×
                  </span>
                </>
              )}
              <span className="shrink-0 [&_svg]:size-5" aria-hidden="true">
                {item.icon}
              </span>
            </span>
            <span className="min-w-0 wrap-anywhere">{item.label}</span>
          </FactTag>
        </li>
      ))}
    </ul>
  )
}
