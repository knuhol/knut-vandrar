import type { ReactNode, Ref } from 'react'

export function MapFrame({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  // Keep MapLibre overlays below the sticky site header.
  return (
    <div ref={ref} className="relative isolate aspect-square w-full tablet:aspect-video">
      {children}
    </div>
  )
}
