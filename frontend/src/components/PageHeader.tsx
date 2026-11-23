import type { ReactNode } from 'react'

import { Container } from './Container'
import { Heading } from './Heading'
import type { UIComponentProps } from './uiComponentProps'

export function PageHeader({
  eyebrow,
  title,
  introduction,
  media,
  entrance = false,
  children,
}: UIComponentProps<{
  eyebrow: string
  title: string
  introduction: string
  entrance?: boolean
  media?: ReactNode
  children?: ReactNode
}>) {
  return (
    <header className={media ? 'bg-cream' : 'border-b border-beige bg-cream'}>
      <Container>
        <div
          className={
            (entrance ? 'content-enter ' : '') +
            (media
              ? 'grid items-center gap-9 py-10 tablet:gap-12 tablet:py-16 desktop:grid-cols-2 desktop:gap-20 desktop:py-20'
              : 'py-10 tablet:py-16')
          }
        >
          <div className="min-w-0">
            <Heading tone="brand" eyebrow={eyebrow}>
              {title}
            </Heading>
            <p
              className={
                media ? 'mt-6 max-w-reading text-xl text-forest' : 'mt-6 text-xl text-forest'
              }
            >
              {introduction}
            </p>
            {children}
          </div>
          {media}
        </div>
      </Container>
    </header>
  )
}
