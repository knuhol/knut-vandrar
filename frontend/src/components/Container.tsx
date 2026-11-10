import type { ComponentPropsWithoutRef } from 'react'

export function Container({
  as: Tag = 'div',
  className = '',
  ...props
}: ComponentPropsWithoutRef<'div'> & { as?: 'div' | 'main' }) {
  return <Tag {...props} className={`mx-auto w-full max-w-page px-5 tablet:px-7 ${className}`} />
}
