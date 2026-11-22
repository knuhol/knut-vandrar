import {
  IconTrophy,
  IconFootsteps,
  IconWorldLatitude,
  IconMountain,
  IconCompass,
  IconTent,
  IconBackpack,
} from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { FactTag } from './FactTag'

import { Heading } from '@/components/Heading'
import type { HikeDetails } from '@/hiking/details'
import type { Hike } from '@/api/hikes'

export function HikeAchievements({
  details,
  status,
}: {
  details: HikeDetails
  status: Hike['status']
}) {
  const t = useTranslations('Site.achievements')
  const isActive = status === 'planned' || status === 'ongoing'
  const icons = {
    backpack: IconBackpack,
    trophy: IconTrophy,
    distance: IconFootsteps,
    arctic: IconWorldLatitude,
    mountain: IconMountain,
    compass: IconCompass,
    tent: IconTent,
  }
  const items = details.achievements.map((item) => ({
    id: item.id,
    label: item.title,
    description: item.description,
    Icon: icons[item.icon],
  }))

  if (items.length === 0) {
    return null
  }

  return (
    <section>
      <div className="mb-4">
        <Heading as="h3" tone="brand">
          {t('title')}
        </Heading>
        {isActive && <p className="mt-1 text-sm text-muted">{t('goals')}</p>}
      </div>
      <ul className="flex flex-wrap items-start gap-2">
        {items.map(({ id, label, description, Icon }) => (
          <li key={id} className="max-w-full">
            <FactTag kind="milestone">
              <Icon className="size-5 shrink-0 text-orange-dark" aria-hidden="true" />
              <span className="min-w-0">
                {label}
                {description && (
                  <span className="mt-1 block text-xs font-normal text-muted">{description}</span>
                )}
              </span>
            </FactTag>
          </li>
        ))}
      </ul>
    </section>
  )
}
