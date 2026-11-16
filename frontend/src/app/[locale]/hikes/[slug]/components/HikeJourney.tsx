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

import { HikeSection } from './HikeSection/HikeSection'

import { Heading } from '@/components/Heading'
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

export function hasHikeJourney(details: HikeDetails) {
  return Boolean(
    details.scope ||
    details.direction ||
    details.stages ||
    details.achievements.length > 0 ||
    details.overnights.some((stay) => stay.count > 0),
  )
}

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

  if (!hasHikeJourney(details)) {
    return null
  }

  return (
    <HikeSection id="journey" title={t('title')} variant="panel">
      <div className="grid items-start gap-8 tablet:grid-cols-2">
        {routeItems.length > 0 && (
          <div>
            <div className="mb-4">
              <Heading as="h3" tone="brand">
                {t('route')}
              </Heading>
            </div>
            <FactItems items={routeItems} />
          </div>
        )}
        {overnights.length > 0 && (
          <div>
            <div className="mb-4">
              <Heading as="h3" tone="brand">
                {t(status === 'planned' ? 'plannedNights' : 'overnights')}
              </Heading>
            </div>
            <AccommodationOptions options={overnights} />
          </div>
        )}
        {hasAchievements && (
          <div className="min-w-0 tablet:col-span-2">
            <HikeAchievements details={details} status={status} />
          </div>
        )}
      </div>
    </HikeSection>
  )
}
