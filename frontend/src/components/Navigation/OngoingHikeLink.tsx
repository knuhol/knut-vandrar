'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'

import { useHikeActivity } from '../HikeActivity'

import { getPathname, Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

export function OngoingHikeLink({
  locale,
  slug,
  sending,
}: {
  locale: Locale
  slug?: string
  sending?: boolean
}) {
  const t = useTranslations('Site')
  const pathname = usePathname()
  const activity = useHikeActivity()
  const target = slug ?? activity?.slug
  if (!target) {
    return null
  }
  const href = { pathname: '/hikes/[slug]', params: { slug: target } } as const
  const live = sending ?? activity?.sending ?? false

  return (
    <Link
      href={href}
      aria-current={pathname === getPathname({ locale, href }) ? 'page' : undefined}
      aria-label={t('ongoingHikeLink')}
      data-link-kind="button"
      className="header-control shrink-0 whitespace-nowrap"
    >
      <span
        className={`relative size-2.5 shrink-0 rounded-full border border-paper ${live ? 'live-position-pulse bg-live-position' : 'bg-orange'}`}
        aria-hidden="true"
      />
      <span className="desktop:hidden">{t('ongoingHikeCompact')}</span>
      <span className="hidden desktop:inline">{t('ongoingHikeLink')}</span>
    </Link>
  )
}
