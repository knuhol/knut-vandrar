import { useTranslations } from 'next-intl'
import {
  IconMountain as Mountain,
  IconTrees as Trees,
  IconMapPin as MapPin,
  IconWorldLatitude as Latitude,
  IconSignRight as Sign,
  IconCompass as Compass,
  IconBeach as Beach,
  IconRepeat as Loop,
} from '@tabler/icons-react'

import type { TrailTag } from '@/hiking/presentation'

const icons = {
  mountains: Mountain,
  lowlands: Trees,
  coastal: Beach,
  loop: Loop,

  aboveArcticCircle: Latitude,
  crossesArcticCircle: Latitude,

  waymarked: Sign,
  partlyWaymarked: Sign,
  unmarked: Compass,
} satisfies Record<TrailTag, typeof Mountain>

export function TrailTags({ tags, regions = [] }: { tags: TrailTag[]; regions?: string[] }) {
  const t = useTranslations('Site.trailTags')

  if (tags.length === 0 && regions.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('label')}>
      {regions.map((region) => (
        <li
          key={region}
          className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-beige px-2.5 py-1.5 text-sm text-forest"
        >
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span>{region}</span>
        </li>
      ))}
      {[...new Set(tags)].map((tag) => {
        const Icon = icons[tag]

        return (
          <li
            key={tag}
            className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-beige px-2.5 py-1.5 text-sm text-forest"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{t(tag)}</span>
          </li>
        )
      })}
    </ul>
  )
}
