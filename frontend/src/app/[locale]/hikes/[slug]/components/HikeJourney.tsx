import {
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconRoute,
  IconRotateClockwise,
  IconRotate,
} from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { FactItems } from './FactItems'
import { AccommodationOptions } from './AccommodationOptions'
import { HikeAchievements } from './HikeAchievements'

import type { HikeDetails } from '@/hiking/details'
import type { Hike } from '@/api/hikes'

const directions = {
  northbound: IconArrowUp,
  southbound: IconArrowDown,
  eastbound: IconArrowRight,
  westbound: IconArrowLeft,
  clockwise: IconRotateClockwise,
  counterclockwise: IconRotate,
} satisfies Record<NonNullable<HikeDetails['direction']>, typeof IconArrowUp>

export function HikeJourney({ details, status }: { details: HikeDetails; status: Hike['status'] }) {
  const t = useTranslations('Site.journey')
  const DirectionIcon = details.direction && directions[details.direction]
  const overnights = details.overnights.filter((stay) => stay.count > 0)
  const hasAchievements = details.achievements.length > 0
  const routeItems = [
    ...(details.scope
      ? [{ id: 'scope', label: t(`scope.${details.scope}`), icon: <IconRoute /> }]
      : []),
    ...(DirectionIcon && details.direction
      ? [{ id: 'direction', label: t(details.direction), icon: <DirectionIcon /> }]
      : []),
    ...(details.stages
      ? [
          {
            id: 'stages',
            label: t('stages', { from: details.stages.start, to: details.stages.end }),
            icon: <IconRoute />,
          },
        ]
      : []),
  ]

  if (routeItems.length === 0 && !hasAchievements && overnights.length === 0) {
    return null
  }

  return (
    <div className="mt-5 grid gap-4 border-t border-beige pt-5 tablet:grid-cols-2 tablet:gap-8">
      {routeItems.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-forest">{t('route')}</h3>
          <div className="grid gap-2">
            {routeItems.length > 0 && <FactItems items={routeItems} />}
          </div>
        </div>
      )}
      {overnights.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-forest">
            {t(status === 'planned' ? 'plannedNights' : 'overnights')}
          </h3>
          <AccommodationOptions options={overnights} />
        </div>
      )}
      {hasAchievements && (
        <div className="border-t border-beige pt-5 tablet:col-span-2">
          <HikeAchievements details={details} status={status} />
        </div>
      )}
    </div>
  )
}
