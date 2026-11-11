'use client'

import { useEffect, useRef } from 'react'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconArrowDown } from '@tabler/icons-react'

import { Eyebrow } from '../Eyebrow'
import styles from './Hero.module.css'

import { ButtonLink } from '@/components/Button'
import { Heading } from '@/components/Heading'

export function Hero() {
  const t = useTranslations('Site')
  const hero = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = hero.current

    if (!element) {
      return
    }

    const breakpoint = getComputedStyle(element).getPropertyValue('--breakpoint-desktop').trim()
    const enabled = window.matchMedia(
      `(min-width: ${breakpoint}) and (prefers-reduced-motion: no-preference)`,
    )
    let frame: number | undefined
    let previousOffset = -1

    const update = () => {
      frame = undefined
      const offset = enabled.matches ? Math.min(Math.max(window.scrollY, 0) * 0.08, 30) : 0

      if (offset === previousOffset) {
        return
      }
      element.style.setProperty('--poster-offset', `${String(offset)}px`)
      previousOffset = offset
    }

    const schedule = () => {
      frame ??= window.requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    enabled.addEventListener('change', schedule)

    return () => {
      window.removeEventListener('scroll', schedule)
      enabled.removeEventListener('change', schedule)
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [])

  return (
    <section
      className={`relative isolate overflow-clip bg-cream wide:min-h-122.5 ${styles.landscape}`}
      ref={hero}
    >
      <div className={styles.copy}>
        <div className="grid gap-5 desktop:max-w-220 desktop:grid-cols-[minmax(0,1fr)_calc(var(--spacing)*40)] desktop:items-start desktop:gap-10">
          <Image
            className="h-24 w-24 shrink-0 rounded-full border-3 border-orange object-cover shadow-sm desktop:col-start-2 desktop:row-start-1 desktop:h-40 desktop:w-40"
            src="/knut.png"
            alt={t('author')}
            width={160}
            height={160}
            sizes="(min-width: 1001px) 160px, 96px"
          />
          <div className="min-w-0 desktop:col-start-1 desktop:row-start-1">
            <Eyebrow>{t('heroEyebrow')}</Eyebrow>
            <div className="mb-4.5 max-w-80 tablet:max-w-162.5">
              <Heading tone="brand">{t('title')}</Heading>
            </div>
            <p className="mb-3.5 max-w-80 text-lg tablet:max-w-117.5 tablet:text-xl">
              {t('intro')}
            </p>
            <ButtonLink variant="primary" href={{ pathname: '/', hash: 'hikes' }}>
              {t('explore')}
              <IconArrowDown className="size-4.5 shrink-0" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}
