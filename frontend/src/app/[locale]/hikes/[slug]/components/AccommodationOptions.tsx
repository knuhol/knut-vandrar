import { IconTent, IconHomeEco, IconBuildingCottage, IconBed } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { FactItems } from './FactItems'

import type { AccommodationType } from '@/hiking/details'

const icons = {
  tent: IconTent,
  freeShelter: IconHomeEco,
  mountainHut: IconBuildingCottage,
  paidAccommodation: IconBed,
} satisfies Record<AccommodationType, typeof IconTent>

export function AccommodationOptions({
  options,
}: {
  options: { type: AccommodationType; count?: number }[]
}) {
  const t = useTranslations('Site.accommodation')

  return (
    <FactItems
      items={options.map(({ type, count }) => {
        const Icon = icons[type]

        return { id: type, label: t(type), icon: <Icon />, count }
      })}
    />
  )
}
