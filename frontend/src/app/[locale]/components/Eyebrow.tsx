import type { ComponentProps } from 'react'

export function Eyebrow({ className = '', ...props }: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      className={`text-eyebrow font-bold tracking-eyebrow text-forest uppercase ${className}`}
    />
  )
}
