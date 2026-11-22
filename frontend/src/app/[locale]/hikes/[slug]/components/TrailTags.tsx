import { useTranslations } from 'next-intl'
import {
  IconPlant2 as Plant,
  IconMountain as Mountain,
  IconTrees as Trees,
  IconMapPin as MapPin,
  IconWorldLatitude as Latitude,
  IconSignRight as Sign,
  IconCompass as Compass,
  IconBeach as Beach,
  IconRepeat as Loop,
  IconShip as Boat,
} from '@tabler/icons-react'

import { HikeBadge } from './HikeBadge'

import type { TrailTag } from '@/hiking/presentation'

const icons = {
  nationalPark: Plant,
  mountains: Mountain,
  lowlands: Trees,
  coastal: Beach,
  loop: Loop,

  aboveArcticCircle: Latitude,
  crossesArcticCircle: Latitude,

  waymarked: Sign,
  partlyWaymarked: Sign,
  unmarked: Compass,
  boatConnectionRequired: Boat,
} satisfies Record<TrailTag, typeof Mountain>

export function TrailTags({ tags, regions = [] }: { tags: TrailTag[]; regions?: string[] }) {
  const t = useTranslations('Site.trailTags')

  if (tags.length === 0 && regions.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('label')}>
      {regions.map((region) => (
        <li key={region} className="max-w-full">
          <HikeBadge kind="characteristic">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span>{region}</span>
          </HikeBadge>
        </li>
      ))}
      {[...new Set(tags)].map((tag) => {
        const Icon = icons[tag]

        return (
          <li key={tag} className="max-w-full">
            <HikeBadge kind="characteristic">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{t(tag)}</span>
            </HikeBadge>
          </li>
        )
      })}
    </ul>
  )
}
