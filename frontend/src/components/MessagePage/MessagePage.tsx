import type { ReactNode } from 'react'

import styles from './MessagePage.module.css'

import { Heading } from '@/components/Heading'

export function MessagePage({
  code,
  title,
  description,
  children,
  alert = false,
}: {
  code: string
  title: string
  description: string
  children: ReactNode
  alert?: boolean
}) {
  return (
    <div
      className={`relative isolate grid flex-1 place-items-center overflow-hidden bg-cream p-6 text-center tablet:p-12 ${styles.background}`}
    >
      <section
        className="w-full max-w-255 rounded-lg border border-beige bg-paper p-8 shadow-lg tablet:p-16"
        aria-labelledby="message-title"
        role={alert ? 'alert' : undefined}
      >
        <p className="mb-3 font-statistic text-6xl leading-tight font-semibold text-forest">
          {code}
        </p>
        <div className="mb-3.5">
          <Heading id="message-title" tone="brand">
            {title}
          </Heading>
        </div>
        <p className="mx-auto mb-7 max-w-205 text-muted">{description}</p>
        {children}
      </section>
    </div>
  )
}
