import { IconExternalLink } from '@tabler/icons-react'

import type { ReactNode } from 'react'

export function InfoCard({
  icon,
  title,
  href,
  description,
  inactive = false,
  onClick,
  onActivate,
  expanded,
  emphasis = 'standard',
}: {
  icon: ReactNode
  title: string
  href?: string
  description: string
  inactive?: boolean
  onActivate?: () => void
  onClick?: () => void
  expanded?: boolean
  emphasis?: 'standard' | 'film'
}) {
  const film = emphasis === 'film'
  const surface = film
    ? 'border-orange bg-orange text-ink [--link-interaction-color:var(--color-ink)]'
    : 'border-forest-outline border-l-orange bg-paper text-forest'
  const interactive = Boolean((href || onClick) && !inactive)
  const Tag = interactive ? (onClick ? 'button' : 'a') : 'article'

  return (
    <Tag
      href={interactive && !onClick ? href : undefined}
      target={interactive && !onClick ? '_blank' : undefined}
      rel={interactive && !onClick ? 'noopener noreferrer' : undefined}
      type={onClick ? 'button' : undefined}
      onClick={
        interactive
          ? () => {
              onActivate?.()
              onClick?.()
            }
          : undefined
      }
      onAuxClick={
        interactive && href && !onClick
          ? (event) => {
              if (event.button === 1) {
                onActivate?.()
              }
            }
          : undefined
      }
      aria-expanded={onClick ? expanded : undefined}
      aria-haspopup={onClick ? 'dialog' : undefined}
      data-link-kind={interactive ? 'card' : undefined}
      className={`group relative flex min-h-13 w-full items-center gap-3 rounded-sm border border-l-2 px-3 py-2.5 text-left ${surface} ${interactive ? 'card-interactive cursor-pointer' : 'opacity-60'}`}
    >
      <span className="grid size-6 shrink-0 place-items-center [&>svg]:size-5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-display text-sm leading-tight ${film ? 'font-bold' : 'font-semibold'}`}
        >
          {title}
        </span>
        <span
          data-link-label={interactive ? true : undefined}
          className={`mt-1 block text-xs leading-relaxed ${film ? 'text-ink' : 'text-muted group-hover:text-forest'}`}
        >
          {description}
        </span>
      </span>
      {interactive && !onClick && (
        <IconExternalLink className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Tag>
  )
}
