import type { CoverSources } from '@/api/images'
import { RevealImage } from '@/components/RevealImage'
import { responsiveMedia } from '@/config/breakpoints'

export function HikeCoverPicture({ covers, title }: { covers: CoverSources; title: string }) {
  return (
    <picture className="absolute inset-0 -z-20 overflow-hidden">
      {covers.wide && (
        <source media={responsiveMedia.fullHikeCover} type="image/avif" srcSet={covers.wide} />
      )}
      <source media={responsiveMedia.fullHikeCover} srcSet={covers.full} />
      <source media={responsiveMedia.desktopHikeCover} srcSet={covers.desktop} />
      <RevealImage
        src={covers.mobile}
        alt={title}
        fill
        fit="cover"
        loading="eager"
        fetchPriority="high"
        unoptimized
        sizes="100vw"
      />
    </picture>
  )
}
