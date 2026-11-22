'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'

import { useReadingNavigation } from '../ReadingNavigation'
import styles from './SiteHeader.module.css'

export function SiteHeader({
  brand,
  brandIcon,
  navigation,
  languages,
}: {
  brand: ReactNode
  brandIcon?: ReactNode
  navigation: ReactNode
  languages: ReactNode
}) {
  const header = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const { active, siteMenuOpen, setSiteMenuOpen, setSlot } = useReadingNavigation()
  const t = useTranslations('Site')
  const reading = active && !siteMenuOpen

  useEffect(() => {
    const element = header.current
    if (!element) {
      return
    }
    const update = () => {
      document.documentElement.style.setProperty(
        '--header-height',
        `${String(element.getBoundingClientRect().height)}px`,
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!siteMenuOpen) {
      return
    }
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSiteMenuOpen(false)
        menuButton.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('keydown', dismiss)
    }
  }, [siteMenuOpen, setSiteMenuOpen])

  return (
    <header
      ref={header}
      data-site-header
      className={`${active ? styles.contextAvailable : ''} sticky top-0 z-40 border-b border-beige bg-cream shadow-sm`}
    >
      <div
        className={`${styles.frame} mx-auto flex max-w-page items-center px-4 py-3 tablet:px-8 tablet:py-5.5`}
      >
        <div className={`${styles.brand} relative h-11 w-47.5 shrink-0 tablet:w-64 desktop:w-80`}>
          <div className={styles.brandFull}>{brand}</div>
          <div className={styles.brandIcon}>{brandIcon ?? brand}</div>
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className={`${styles.track} ${reading ? styles.trackReading : ''}`}>
            <div
              inert={reading}
              aria-hidden={reading ? true : undefined}
              className={`${styles.pane} ${reading ? styles.inactive : ''} flex min-w-0 items-center justify-end`}
            >
              {navigation}
              {languages}
            </div>
            <div
              ref={setSlot}
              id="header-submenu"
              inert={!reading}
              aria-hidden={!reading ? true : undefined}
              className={`${styles.pane} ${!reading ? styles.inactive : ''} min-w-0`}
            />
          </div>
        </div>
        <button
          ref={menuButton}
          inert={!active}
          aria-hidden={!active ? true : undefined}
          type="button"
          aria-label={t(reading ? 'showMainMenu' : 'showSubmenu')}
          aria-controls="header-submenu"
          aria-expanded={reading}
          onClick={() => {
            setSiteMenuOpen(!siteMenuOpen)
          }}
          className={`${styles.switcher} ${!active ? styles.switcherHidden : ''} grid size-11 shrink-0 cursor-pointer place-items-center text-forest hover:text-forest-dark`}
        >
          {reading ? (
            <IconArrowRight className="size-5" aria-hidden="true" />
          ) : (
            <IconArrowLeft className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  )
}
