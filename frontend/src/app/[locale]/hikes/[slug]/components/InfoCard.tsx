import { IconExternalLink } from '@tabler/icons-react'

import type { ReactNode } from 'react'

export function InfoCard({
  icon,
  title,
  href,
  action,
  message,
  inactive = false,
  onClick,
  onActivate,
  expanded,
  variant = 'default',
  emphasis = 'standard',
}: {
  icon: ReactNode
  title: string
  href?: string
  action?: string
  message?: string
  inactive?: boolean
  onActivate?: () => void
  onClick?: () => void
  expanded?: boolean
  variant?: 'default' | 'video' | 'compact'
  emphasis?: 'standard' | 'film' | 'equipment'
}) {
  const compact = variant === 'compact'
  const film = variant === 'video' || emphasis === 'film'
  const compactSurface = film
    ? 'border-orange bg-orange text-ink [--link-interaction-color:var(--color-ink)]'
    : 'border-forest-outline border-l-orange bg-paper text-forest [--link-interaction-color:var(--color-forest)]'
  const compactInteraction = film
    ? 'hover:border-orange-dark hover:bg-orange-dark hover:shadow-sm focus-visible:border-orange-dark focus-visible:bg-orange-dark focus-visible:shadow-sm'
    : 'hover:border-forest hover:border-l-orange hover:shadow-sm focus-visible:border-forest focus-visible:border-l-orange focus-visible:shadow-sm'
  const interactive = Boolean((href || onClick) && !inactive && !message)
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
      className={`group relative flex w-full items-center gap-3 text-left ${compact ? `min-h-13 rounded-sm border border-l-2 px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-(--duration-fast) ${compactSurface}` : `min-h-20 rounded-lg p-4 ${inactive ? 'bg-beige text-muted' : variant === 'video' ? 'bg-orange text-ink' : 'bg-paper text-forest'}`} ${interactive ? (compact ? `cursor-pointer ${compactInteraction}` : 'card-interactive cursor-pointer') : 'opacity-60'}`}
    >
      <span
        className={`grid shrink-0 place-items-center [&>svg]:size-5 ${compact ? 'size-6' : `size-9 rounded-full ${inactive ? 'bg-forest/10' : variant === 'video' ? 'bg-ink/10' : 'bg-cream'}`}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-display ${compact ? 'text-sm' : 'text-base'} leading-tight ${!compact || emphasis === 'film' ? 'font-bold' : 'font-semibold'}`}
        >
          {title}
        </span>
        {(message || action) && (
          <span
            data-link-label={interactive ? true : undefined}
            className={`mt-1 block ${compact ? 'text-xs leading-relaxed' : 'text-sm'} ${film ? 'text-ink' : 'text-muted group-hover:text-forest'}`}
          >
            {message || action}
          </span>
        )}
      </span>
      {interactive && !onClick && (
        <IconExternalLink className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Tag>
  )
}
