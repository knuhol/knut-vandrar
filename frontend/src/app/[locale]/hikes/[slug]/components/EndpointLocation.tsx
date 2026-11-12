import { IconArrowUpRight } from '@tabler/icons-react'
import { useFormatter, useTranslations } from 'next-intl'

import { googleMapsUrl, type Coordinates } from '@/maps/googleMaps'

export function EndpointLocation({
  name,
  coordinates,
}: {
  name: string | null
  coordinates?: Coordinates | null
}) {
  const t = useTranslations('Site')
  const format = useFormatter()
  const label =
    name ||
    (coordinates &&
      `${format.number(coordinates.latitude, { maximumFractionDigits: 6 })}, ${format.number(coordinates.longitude, { maximumFractionDigits: 6 })}`)

  if (!coordinates) {
    return label
  }

  return (
    <a
      className="link-dotted inline-flex max-w-full items-baseline gap-1.5"
      href={googleMapsUrl(coordinates)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('openInGoogleMaps', { place: label ?? '' })}
    >
      <span className="min-w-0 wrap-anywhere">{label}</span>
      <IconArrowUpRight className="size-4 shrink-0 self-center" aria-hidden="true" />
    </a>
  )
}
