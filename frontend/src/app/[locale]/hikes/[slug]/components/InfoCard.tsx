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
  expanded,
  variant = 'default',
}: {
  icon: ReactNode
  title: string
  href?: string
  action?: string
  message?: string
  inactive?: boolean
  onClick?: () => void
  expanded?: boolean
  variant?: 'default' | 'video'
}) {
  const interactive = Boolean((href || onClick) && !inactive && !message)
  const Tag = interactive ? (onClick ? 'button' : 'a') : 'article'

  return (
    <Tag
      href={interactive && !onClick ? href : undefined}
      target={interactive && !onClick ? '_blank' : undefined}
      rel={interactive && !onClick ? 'noopener noreferrer' : undefined}
      type={onClick ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      aria-expanded={onClick ? expanded : undefined}
      aria-haspopup={onClick ? 'dialog' : undefined}
      data-link-kind={interactive ? 'card' : undefined}
      className={`flex min-h-20 w-full items-center gap-3 rounded-lg border p-4 text-left ${variant === 'video' ? 'border-forest bg-forest text-cream' : 'border-beige bg-paper text-forest'} ${interactive ? 'card-interactive cursor-pointer' : ''} ${inactive ? 'text-muted' : ''}`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full [&>svg]:size-5 ${variant === 'video' ? 'bg-cream/15' : 'bg-cream'}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base leading-tight font-bold">{title}</span>
        {(message || action) && (
          <span
            data-link-label={interactive ? true : undefined}
            className={`mt-1 block text-sm ${variant === 'video' ? 'text-cream/80' : 'text-muted'}`}
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
