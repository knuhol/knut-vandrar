import type { ReactNode } from 'react'

import type { HikeSectionId } from '../hikeSections'

import { Heading } from '@/components/Heading'

export function HikeSection({
  id,
  title,
  meta,
  children,
  as: Tag = 'section',
  variant = 'plain',
  heading = 'visible',
}: {
  id: HikeSectionId
  title: string
  meta?: ReactNode
  children: ReactNode
  as?: 'section' | 'article'
  variant?: 'plain' | 'panel' | 'paper' | 'contrast'
  heading?: 'visible' | 'hidden' | 'prominent'
}) {
  return (
    <Tag
      id={id}
      className={`min-w-0 rounded-lg ${variant === 'plain' ? '' : 'p-5 tablet:p-8'} ${variant === 'panel' ? 'bg-cream' : ''} ${variant === 'paper' ? 'border border-beige bg-paper' : ''} ${variant === 'contrast' ? 'bg-forest text-cream' : ''}`}
      aria-labelledby={`${id}-title`}
    >
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
            tone={variant === 'contrast' ? 'inverse' : 'brand'}
          >
            {title}
          </Heading>
        </div>
        {meta && (
          <span className={`text-sm ${variant === 'contrast' ? 'text-beige' : 'text-muted'}`}>
            {meta}
          </span>
        )}
      </div>
      {children}
    </Tag>
  )
}
