import type { ComponentProps } from 'react'

export function Eyebrow({ className = '', ...props }: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      className={`font-statistic text-xs font-bold tracking-widest text-forest uppercase ${className}`}
    />
  )
}
