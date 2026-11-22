import type { ReactNode } from 'react'

import type { HikeSectionId } from '../hikeSections'

import { Heading } from '@/components/Heading'

export function HikeSection({
  id,
  title,
  meta,
  children,
  as: Tag = 'section',
  heading = 'visible',
}: {
  id: HikeSectionId
  title: string
  meta?: ReactNode
  children: ReactNode
  as?: 'section' | 'article'
  heading?: 'visible' | 'hidden' | 'prominent'
}) {
  return (
    <Tag id={id} className="min-w-0" aria-labelledby={`${id}-title`}>
      <div
        className={
          heading === 'hidden'
            ? 'sr-only'
            : 'mb-6 flex flex-wrap items-baseline justify-between gap-3'
        }
      >
        <div className="min-w-0">
          <Heading
            as="h2"
            id={`${id}-title`}
            className={heading === 'prominent' ? 'text-3xl' : 'text-xl'}
            tone="brand"
          >
            {title}
          </Heading>
        </div>
        {meta && <div className="text-sm text-muted">{meta}</div>}
      </div>
      {children}
    </Tag>
  )
}
