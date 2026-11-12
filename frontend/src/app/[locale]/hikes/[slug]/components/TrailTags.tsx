import { useTranslations } from 'next-intl'
import {
  IconMountain as Mountain,
  IconTrees as Trees,
  IconMapPin as MapPin,
  IconWorldLatitude as Latitude,
  IconRoute as Route,
  IconRouteAltLeft as CustomRoute,
  IconSignRight as Sign,
  IconCompass as Compass,
  IconBeach as Beach,
  IconRepeat as Loop,
} from '@tabler/icons-react'

import type { TrailTag } from '@/mocks/trailTags'

const icons = {
  mountains: Mountain,
  lowlands: Trees,
  coastal: Beach,
  loop: Loop,
  lapland: MapPin,
  aboveArcticCircle: Latitude,
  crossesArcticCircle: Latitude,
  establishedRoute: Route,
  selfPlannedRoute: CustomRoute,
  waymarked: Sign,
  partlyWaymarked: Sign,
  unmarked: Compass,
} satisfies Record<TrailTag, typeof Mountain>

export function TrailTags({ tags }: { tags: TrailTag[] }) {
  const t = useTranslations('Site.trailTags')

  if (tags.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('label')}>
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
