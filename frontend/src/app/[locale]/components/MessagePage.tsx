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
    <main
      id="content"
      className={`relative isolate grid min-h-svh place-items-center overflow-hidden bg-cream p-(--message-padding) text-center ${styles.background}`}
    >
      <section
        className="w-full max-w-155 rounded-message border border-(--message-border) bg-(--message-background) p-(--message-card-padding) shadow-message backdrop-blur-(--message-blur)"
        aria-labelledby="message-title"
        role={alert ? 'alert' : undefined}
      >
        <p className="mb-3 font-statistic text-code leading-code font-semibold text-forest">
          {code}
        </p>
        <Heading id="message-title" size="message" className="mb-3.5 text-forest">
          {title}
        </Heading>
        <p className="mx-auto mb-7 max-w-105 text-muted">{description}</p>
        {children}
      </section>
    </main>
  )
}
