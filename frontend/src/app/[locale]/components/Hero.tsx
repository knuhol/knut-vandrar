'use client'

import { useEffect, useRef } from 'react'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconArrowDown } from '@tabler/icons-react'

import styles from './Hero.module.css'

import { Eyebrow } from './Eyebrow'
import portrait from '@/assets/knut.png'
import { ButtonLink } from '@/components/Button'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'

export function Hero() {
  const t = useTranslations('Site')
  const hero = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = hero.current
    if (!element) return
    const breakpoint = getComputedStyle(element).getPropertyValue('--breakpoint-parallax').trim()
    const enabled = window.matchMedia(
      `(min-width: ${breakpoint}) and (prefers-reduced-motion: no-preference)`,
    )
    let frame: number | undefined
    let previousOffset = -1
    const update = () => {
      frame = undefined
      const offset = enabled.matches ? Math.min(Math.max(window.scrollY, 0) * 0.08, 30) : 0
      if (offset === previousOffset) return
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
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section
      className={`relative isolate overflow-clip bg-cream wide:min-h-122.5 ${styles.landscape}`}
      ref={hero}
    >
      <Container className={styles.copy}>
        <div className="grid gap-5 desktop:max-w-220 desktop:grid-cols-[minmax(0,1fr)_var(--hero-avatar-size)] desktop:items-start desktop:gap-10">
          <Image
            className="h-24 w-24 shrink-0 rounded-full border-3 border-orange object-cover shadow-avatar desktop:col-start-2 desktop:row-start-1 desktop:h-40 desktop:w-40"
            src={portrait}
            alt={t('author')}
            width={160}
            height={160}
            sizes="(min-width: 1001px) 160px, 96px"
          />
          <div className="min-w-0 desktop:col-start-1 desktop:row-start-1">
            <Eyebrow>{t('heroEyebrow')}</Eyebrow>
            <Heading size="hero" className="mb-4.5 max-w-80 text-forest tablet:max-w-162.5">
              {t('title')}
            </Heading>
            <p className="mb-3.5 max-w-80 text-info tablet:max-w-117.5 tablet:text-card">
              {t('intro')}
            </p>
            <ButtonLink variant="accent" href="#hikes">
              {t('explore')}
              <IconArrowDown className="size-4.5 shrink-0" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  )
}
