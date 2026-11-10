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
  return (
    <article
      className={`grid min-h-36 grid-cols-[var(--info-icon-size)_minmax(0,1fr)] content-center gap-3 rounded-panel border border-line p-6 [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:text-forest ${inactive ? 'bg-inactive text-muted' : 'bg-cream'}`}
    >
      {icon}
      <Heading as="h3" size="info" className="col-start-2">
        {title}
      </Heading>
      {message ? (
        <p className="col-start-2 text-action">{message}</p>
      ) : (
        href && (
          <a
            className="col-start-2 inline-flex items-center gap-2.5 font-semibold text-forest"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {action}
            <IconExternalLink className="size-4 shrink-0" aria-hidden="true" />
          </a>
        )
      )}
    </article>
  )
}
