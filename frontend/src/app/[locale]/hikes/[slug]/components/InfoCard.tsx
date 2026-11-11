import { IconExternalLink } from '@tabler/icons-react'

import type { ReactNode } from 'react'

import { Heading } from '@/components/Heading'

export function InfoCard({
  icon,
  title,
  href,
  action,
  message,
  inactive = false,
}: {
  icon: ReactNode
  title: string
  href?: string
  action?: string
  message?: string
  inactive?: boolean
}) {
  const interactive = Boolean(href && !inactive && !message)
  const Tag = interactive ? 'a' : 'article'

  return (
    <Tag
      href={interactive ? href : undefined}
      target={interactive ? '_blank' : undefined}
      rel={interactive ? 'noopener noreferrer' : undefined}
      data-link-kind={interactive ? 'card' : undefined}
      className={`grid min-h-36 grid-cols-[calc(var(--spacing)*6)_minmax(0,1fr)] content-center gap-3 rounded-lg border border-beige bg-cream p-6 [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:text-forest ${interactive ? 'card-interactive cursor-pointer' : ''} ${inactive ? 'text-muted' : ''}`}
    >
      {icon}
      <div className="col-start-2">
        <Heading as="h3" tone="brand">
          {title}
        </Heading>
      </div>
      {message ? (
        <p className="col-start-2 text-base">{message}</p>
      ) : (
        interactive && (
          <span
            data-link-label
            className="col-start-2 inline-flex items-center gap-2.5 font-semibold text-forest"
          >
            {action}
            <IconExternalLink className="size-4 shrink-0" aria-hidden="true" />
          </span>
        )
      )}
    </Tag>
  )
}
