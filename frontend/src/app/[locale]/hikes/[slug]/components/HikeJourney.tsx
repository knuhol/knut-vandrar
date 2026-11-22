import {
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconRoute,
  IconRepeat,
  IconArrowUpRight,
  IconRotateClockwise,
  IconRotate,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
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
    details.isLoop ||
    details.direction ||
    details.stages ||
    details.achievements.length > 0 ||
    details.overnights.some((stay) => stay.count > 0),
  )
}

export function HikeJourney({
  details,
  status,
  facts,
  more,
}: {
  details: HikeDetails
  status: Hike['status']
  facts?: ReactNode
  more?: ReactNode
}) {
  const t = useTranslations('Site.journey')
  const DirectionIcon = details.direction && directions[details.direction]
  const overnights = details.overnights.filter((stay) => stay.count > 0)
  const hasAchievements = details.achievements.length > 0
  const routeItems = [
    ...(details.isLoop ? [{ id: 'loop', label: t('loop'), icon: <IconRepeat /> }] : []),
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

  if (!hasHikeJourney(details) && !facts) {
    return null
  }

  return (
    <HikeSection id="journey" title={t('title')} variant="plain" heading="hidden">
      <div className="grid items-start gap-8 tablet:grid-cols-2 desktop:grid-cols-3">
        {facts && <div className="min-w-0">{facts}</div>}
        {routeItems.length > 0 && (
          <div>
            <div className="mb-4">
              <Heading as="h3" tone="brand">
                {t('route')}
              </Heading>
            </div>
            <FactItems items={routeItems} />
            {details.scope === 'named_hiking_route' && details.namedRoute && (
              <p className="mt-4 text-base font-semibold text-forest">
                {details.namedRoute.url ? (
                  <a
                    className="link-dotted inline-flex items-center gap-1.5"
                    href={details.namedRoute.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {details.namedRoute.name}
                    <IconArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  details.namedRoute.name
                )}
              </p>
            )}
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
          <div className="min-w-0">
            <HikeAchievements details={details} status={status} />
          </div>
        )}
      </div>
      {more && <div className="mt-8">{more}</div>}
    </HikeSection>
  )
}
