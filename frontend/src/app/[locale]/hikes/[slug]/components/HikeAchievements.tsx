import {
  IconTrophy,
  IconFootsteps,
  IconWorldLatitude,
  IconMountain,
  IconCompass,
  IconTent,
} from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

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
      <div className="mb-3">
        <Heading as="h3" className="text-xl">
          {t('title')}
        </Heading>
        {isActive && <p className="mt-1 text-sm text-muted">{t('goals')}</p>}
      </div>
      <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
        {items.map(({ id, label, description, Icon }) => (
          <li
            key={id}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-orange/30 bg-paper p-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange/15 text-orange-dark">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-forest">{label}</span>
              {description && <span className="mt-1 block text-xs text-muted">{description}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
