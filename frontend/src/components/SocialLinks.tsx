import {
  IconArrowUpRight,
  IconBrandInstagram,
  IconBrandYoutube,
  IconViewfinder,
} from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { siteIdentity } from '@/config/site'

const profileIcons = {
  instagram: IconBrandInstagram,
  youtube: IconBrandYoutube,
  plotaroute: IconViewfinder,
}

type Profile = keyof typeof profileIcons

export function SocialLinks({
  profiles,
  variant = 'labeled',
}: {
  profiles: readonly Profile[]
  variant?: 'labeled' | 'compact'
}) {
  const t = useTranslations('Site')

  return (
    <ul
      className={
        variant === 'compact' ? 'flex flex-col items-start gap-1' : 'flex flex-wrap gap-x-5 gap-y-2'
      }
    >
      {profiles.map((profile) => {
        const Icon = profileIcons[profile]

        return (
          <li key={profile}>
            <a
              href={siteIdentity.profiles[profile]}
              className={
                variant === 'compact'
                  ? 'inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-forest'
                  : 'inline-flex min-h-11 items-center gap-2 font-semibold'
              }
            >
              <Icon className="size-5 shrink-0 text-orange" aria-hidden="true" />
              {t(`social.${profile}`)}
              <IconArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
