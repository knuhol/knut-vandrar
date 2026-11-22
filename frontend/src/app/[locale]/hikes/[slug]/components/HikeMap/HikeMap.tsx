import Image from 'next/image'

import { getTranslations } from 'next-intl/server'

import { MapViewer } from './MapViewer/MapViewer'

import { Heading } from '@/components/Heading'
import { imageUrl } from '@/api/images'
import type { HikeMapImage } from '@/api/hikes'
import { responsiveMedia } from '@/config/breakpoints'

export async function HikeMap({
  images,
  hikeTitle,
}: {
  images: HikeMapImage[]
  hikeTitle: string
}) {
  if (images.length === 0) {
    return null
  }
  const fallback = images.find((image) => image.variant === 'mobile') || images[0]
  const t = await getTranslations('Site.map')
  const variants = ['wide', 'desktop', 'tablet'] as const

  const figure = (
    <figure className="overflow-hidden bg-cream">
      <picture>
        {variants.map((variant) => {
          const image = images.find((item) => item.variant === variant)
          return image ? (
            <source
              key={variant}
              media={responsiveMedia[variant]}
              srcSet={imageUrl(image.url)}
              width={image.width}
              height={image.height}
            />
          ) : null
        })}
        <Image
          src={imageUrl(fallback.url)}
          alt={t('alt', { title: hikeTitle })}
          width={fallback.width}
          height={fallback.height}
          className="block h-auto w-full"
          loading="lazy"
          unoptimized
        />
      </picture>
    </figure>
  )

  return (
    <section id="map" aria-labelledby="map-title" className="min-w-0 scroll-mt-(--header-height)">
      <div className="sr-only">
        <Heading as="h2" id="map-title" tone="brand">
          {t('title')}
        </Heading>
      </div>
      <MapViewer images={images} hikeTitle={hikeTitle}>
        {figure}
      </MapViewer>
    </section>
  )
}
