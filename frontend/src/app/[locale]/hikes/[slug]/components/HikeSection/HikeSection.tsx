import type { ReactNode } from 'react'

import { hikeSectionIcons, type HikeSectionId } from '../hikeSections'

import { Heading } from '@/components/Heading'

export function HikeSection({
  id,
  title,
  meta,
  children,
  as: Tag = 'section',
  variant = 'plain',
}: {
  id: HikeSectionId
  title: string
  meta?: ReactNode
  children: ReactNode
  as?: 'section' | 'article'
  variant?: 'plain' | 'panel' | 'paper' | 'contrast'
}) {
  const Icon = hikeSectionIcons[id]

  return (
    <Tag
      id={id}
      className={`min-w-0 rounded-lg ${variant === 'plain' ? '' : 'p-5 tablet:p-8'} ${variant === 'panel' ? 'bg-cream' : ''} ${variant === 'paper' ? 'border border-beige bg-paper' : ''} ${variant === 'contrast' ? 'bg-forest text-cream' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div
          className={`flex min-w-0 items-center gap-3 ${variant === 'plain' ? 'border-l-4 border-orange-dark pl-4 tablet:pl-7' : ''}`}
        >
          <span
            aria-hidden="true"
            className={`grid size-10 shrink-0 place-items-center rounded-sm ${variant === 'contrast' ? 'bg-cream/15 text-orange' : 'bg-orange/15 text-forest'}`}
          >
            <Icon className="size-6" />
          </span>
          <Heading as="h2" id={`${id}-title`} tone={variant === 'contrast' ? 'inverse' : 'brand'}>
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
