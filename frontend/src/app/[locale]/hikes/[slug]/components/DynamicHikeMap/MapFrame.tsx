import type { ReactNode, Ref } from 'react'

export function MapFrame({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="relative aspect-square w-full tablet:aspect-video">
      {children}
    </div>
  )
}
