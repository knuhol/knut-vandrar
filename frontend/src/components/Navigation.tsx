'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { IconMenu2 } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useSyncExternalStore } from 'react'

import type { ComponentProps } from 'react'

import { SectionLink } from './SectionLink'
import { DropdownSurface } from './DropdownSurface'

import styles from './Navigation.module.css'

import type { Locale } from '@/i18n/routing'

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  window.addEventListener('resize', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('scroll', onChange)
    window.removeEventListener('resize', onChange)
    window.removeEventListener('popstate', onChange)
  }
}
function isAtHikes() {
  const section = document.getElementById('hikes')
  const header = document.querySelector('[data-site-header]')
  const threshold = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--navigation-threshold'),
  )
  return (
    section !== null &&
    section.getBoundingClientRect().top <= (header?.getBoundingClientRect().height ?? 0) + threshold
  )
}

function NavigationLink({
  section,
  label,
  ...props
}: ComponentProps<typeof Link> & { section: boolean; label: string }) {
  const Component = section ? SectionLink : Link
  return <Component {...props}>{label}</Component>
}

export function Navigation({ locale }: { locale: Locale }) {
  const t = useTranslations('Site')
  const pathname = usePathname()
  const atHikes = useSyncExternalStore(subscribe, isAtHikes, () => false)
  const hikesActive = pathname !== `/${locale}` || atHikes
  const navigating = useRef(false)
  const links = [
    {
      href: `/${locale}`,
      label: t('home'),
      'aria-current': !hikesActive ? 'page' : undefined,
      section: false,
    },
    {
      href: `/${locale}#hikes`,
      label: t('hikes'),
      'aria-current': hikesActive ? 'location' : undefined,
      section: true,
    },
  ] as const
  return (
    <>
      <nav
        className={`ml-auto hidden gap-7 font-semibold tablet:flex ${styles.links}`}
        aria-label={t('navigation')}
      >
        {links.map((link) => (
          <NavigationLink key={link.href} {...link} />
        ))}
      </nav>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="order-3 inline-flex cursor-pointer items-center justify-center rounded-control border border-line bg-transparent p-2 text-forest tablet:hidden"
          aria-label={t('navigation')}
        >
          <IconMenu2 className="size-5.5 shrink-0" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownSurface
          className={styles.links}
          align="end"
          sideOffset={10}
          onCloseAutoFocus={(event) => {
            if (navigating.current) event.preventDefault()
            navigating.current = false
          }}
        >
          {links.map((link) => (
            <DropdownMenu.Item key={link.href} asChild>
              <NavigationLink
                {...link}
                onClick={() => {
                  navigating.current = true
                }}
              />
            </DropdownMenu.Item>
          ))}
        </DropdownSurface>
      </DropdownMenu.Root>
    </>
  )
}
