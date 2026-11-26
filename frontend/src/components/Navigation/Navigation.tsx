'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { IconMenu2 } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useRef, useState, useSyncExternalStore } from 'react'

import type { ComponentProps } from 'react'

import { SectionLink } from '../SectionLink'
import { MenuItem } from '../MenuItem/MenuItem'
import { DropdownSurface } from '../DropdownSurface'
import type { UIComponentProps } from '../uiComponentProps'

import styles from './Navigation.module.css'

import { Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { prefetchAuthorPortrait } from '@/navigation/prefetchAuthorPortrait'
import { navigateToSection, sectionForHash } from '@/navigation/sectionLink'
import { useCharacterShortcutsEnabled } from '@/navigation/shortcutPreferences'
import { useClickShortcut, usePageShortcut } from '@/navigation/usePageShortcut'

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
  if (window.scrollY === 0 && window.location.hash !== '#hikes') {
    return false
  }

  const section = document.getElementById('hikes')
  const rootStyle = getComputedStyle(document.documentElement)
  const activationLine = Number.parseFloat(rootStyle.scrollPaddingTop)
  const spacing = Number.parseFloat(rootStyle.getPropertyValue('--spacing'))

  return section !== null && section.getBoundingClientRect().top <= activationLine + spacing * 2
}

function NavigationLink({
  section,
  label,
  ...props
}: UIComponentProps<ComponentProps<typeof Link>> & {
  section: boolean
  label: string
}) {
  const Component = section ? SectionLink : Link

  return <Component {...props}>{label}</Component>
}

export function Navigation({ locale }: UIComponentProps<{ locale: Locale }>) {
  const t = useTranslations('Site')
  const pathname = usePathname()
  const homeRouteActive = pathname === `/${locale}` || pathname === `/${locale}/`
  const showShortcutHints = useCharacterShortcutsEnabled() && homeRouteActive
  const authorLink = useClickShortcut<HTMLAnchorElement>('a', { enabled: homeRouteActive })
  usePageShortcut(
    'h',
    () => {
      const hikes = sectionForHash('#hikes')
      if (!hikes) {
        return false
      }
      navigateToSection(hikes, '#hikes')
    },
    { enabled: homeRouteActive },
  )
  const localizedHikeRoute = routing.pathnames['/hikes/[slug]'][locale]
  const hikeActive = pathname.startsWith(`/${locale}${localizedHikeRoute.replace('[slug]', '')}`)
  const atHikesOnPage = useSyncExternalStore(subscribe, isAtHikes, () => false)
  const atHikes = homeRouteActive && atHikesOnPage
  const hikesActive = hikeActive || atHikes
  const homeActive = homeRouteActive && !hikesActive
  const navigating = useRef(false)
  const [open, setOpen] = useState(false)
  const links = [
    {
      id: 'home',
      href: '/',
      label: t('home'),
      'aria-current': homeActive ? 'page' : undefined,
      section: false,
    },
    {
      id: 'hikes',
      href: { pathname: '/', hash: 'hikes' },
      label: t('hikes'),
      'aria-keyshortcuts': showShortcutHints ? 'H' : undefined,
      'aria-current': hikesActive ? 'location' : undefined,
      section: true,
    },
    {
      id: 'about',
      href: '/about',
      label: t('aboutMe'),
      onPointerEnter: prefetchAuthorPortrait,
      onFocus: prefetchAuthorPortrait,
      onClick: prefetchAuthorPortrait,
      'aria-keyshortcuts': showShortcutHints ? 'A' : undefined,
      'aria-current':
        pathname === `/${locale}${routing.pathnames['/about'][locale]}` ? 'page' : undefined,
      section: false,
    },
  ] as const

  return (
    <>
      <nav
        className={`ml-auto hidden items-center gap-7 font-semibold ${styles.links}`}
        aria-label={t('navigation')}
      >
        {links.map(({ id, ...link }) => (
          <NavigationLink key={id} ref={id === 'about' ? authorLink : undefined} {...link} />
        ))}
      </nav>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger
          className={`order-3 inline-flex cursor-pointer items-center justify-center rounded-sm border border-beige bg-transparent p-2 text-forest hover:bg-beige active:bg-beige data-[state=open]:bg-beige ${styles.menuTrigger}`}
          aria-label={t('navigation')}
        >
          <IconMenu2 className="size-5.5 shrink-0" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownSurface
          align="end"
          sideOffset={10}
          onCloseAutoFocus={(event) => {
            if (navigating.current) {
              event.preventDefault()
            }
            navigating.current = false
          }}
        >
          {links.map(({ id, ...link }) => (
            <MenuItem key={id} asChild active={Boolean(link['aria-current'])}>
              <NavigationLink
                {...link}
                onClick={() => {
                  if ('onClick' in link) {
                    link.onClick()
                  }
                  navigating.current = true
                  setOpen(false)
                }}
              />
            </MenuItem>
          ))}
        </DropdownSurface>
      </DropdownMenu.Root>
    </>
  )
}
