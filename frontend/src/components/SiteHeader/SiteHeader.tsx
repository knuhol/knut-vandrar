'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'

import { useHikeActivity } from '../HikeActivity'
import { useReadingNavigation } from '../ReadingNavigation'
import styles from './SiteHeader.module.css'

export function SiteHeader({
  brand,
  brandIcon,
  navigation,
  languages,
  hikeAction,
}: {
  brand: ReactNode
  brandIcon?: ReactNode
  navigation: ReactNode
  languages: ReactNode
  hikeAction?: ReactNode
}) {
  const pathname = usePathname()
  const header = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const { active, siteMenuOpen, setSiteMenuOpen, setSlot } = useReadingNavigation()
  const t = useTranslations('Site')
  const showHikeAction = Boolean(useHikeActivity()) && Boolean(hikeAction)
  const reading = active && !siteMenuOpen

  useEffect(() => {
    const element = header.current
    if (!element) {
      return
    }
    const main = element.nextElementSibling
    let frame: number | undefined

    const updateSurface = () => {
      frame = undefined
      const backdrop = main?.querySelector('[data-header-backdrop]')
      const backdropBottom = backdrop?.getBoundingClientRect().bottom ?? Infinity
      element.toggleAttribute('data-header-backdrop-passed', backdropBottom <= 0)
    }

    const scheduleSurface = () => {
      frame ??= window.requestAnimationFrame(updateSurface)
    }

    const updateHeight = () => {
      const height = element.getBoundingClientRect().height
      document.documentElement.style.setProperty('--header-height', `${String(height)}px`)
      scheduleSurface()
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    window.addEventListener('scroll', scheduleSurface, { passive: true })
    if (main) {
      observer.observe(main)
    }

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', scheduleSurface)
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [pathname])

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
      className={`${styles.surface} ${reading ? styles.reading : ''} ${showHikeAction ? styles.hasHikeAction : ''} sticky top-0 z-40 border-b border-beige bg-cream shadow-sm`}
    >
      <div
        className={`${styles.frame} mx-auto flex max-w-page items-center px-4 py-(--header-block-padding) tablet:px-8`}
      >
        <div
          className={`${styles.brand} relative h-(--spacing-header-brand-height) w-47.5 shrink-0 tablet:w-64 desktop:w-80`}
        >
          <div className={styles.brandFull}>{brand}</div>
          <div className={styles.brandIcon}>{brandIcon ?? brand}</div>
        </div>
        {showHikeAction && <div className="shrink-0">{hikeAction}</div>}
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
              className={`${styles.pane} ${styles.readingPane} ${!reading ? styles.inactive : ''} flex justify-center tablet:justify-end`}
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
          className={`${styles.switcher} ${!active ? styles.switcherHidden : ''} grid size-(--spacing-header-switcher) shrink-0 cursor-pointer place-items-center text-forest hover:text-forest-dark`}
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
