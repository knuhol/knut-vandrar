import type { ComponentProps } from 'react'

const sizes = {
  display: 'text-display',
  section: 'text-section',
  card: 'text-card',
  hero: 'text-hero-mobile tablet:text-display',
  detail: 'text-detail',
  message: 'text-message',
  info: 'text-info',
}
const defaults = { h1: 'display', h2: 'section', h3: 'card' } as const

export function Heading({
  as: Tag = 'h1',
  size = defaults[Tag],
  className = '',
  ...props
}: ComponentProps<'h1'> & { as?: keyof typeof defaults; size?: keyof typeof sizes }) {
  return (
    <Tag
      {...props}
      className={`font-display leading-heading font-extrabold tracking-heading ${sizes[size]} ${className}`}
    />
  )
}
