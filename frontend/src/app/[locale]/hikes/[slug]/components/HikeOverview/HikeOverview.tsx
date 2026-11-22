'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { IconArrowDown } from '@tabler/icons-react'

import styles from './HikeOverview.module.css'

import { motionDuration } from '@/navigation/motion'

export function HikeOverview({ map, children }: { map?: ReactNode; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [moreBelow, setMoreBelow] = useState(false)
  const t = useTranslations('Site')

  useEffect(() => {
    const element = viewport.current
    const contents = content.current
    if (!element || !contents) {
      return
    }
    function update() {
      if (!element) {
        return
      }
      setOverflowing(element.scrollHeight > element.clientHeight + 1)
      setMoreBelow(element.scrollHeight - element.clientHeight - element.scrollTop > 1)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    observer.observe(contents)
    element.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div
      id="resources"
      className={`${styles.recess} ${map ? styles.withMap : ''} relative grid items-start bg-cream ${map ? 'desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}
    >
      {map}
      <div className={`${styles.sidebar} min-w-0`}>
        <div
          ref={viewport}
          className={styles.viewport}
          tabIndex={overflowing ? 0 : undefined}
          role={overflowing ? 'region' : undefined}
          aria-label={overflowing ? t('hikeFacts') : undefined}
        >
          <div
            ref={content}
            className="grid min-w-0 gap-5 px-5 py-8 tablet:px-7 desktop:p-5 wide:p-6"
          >
            {children}
          </div>
        </div>
        {moreBelow && (
          <div className={styles.hint}>
            <button
              type="button"
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-forest-outline bg-cream px-3 py-1 text-xs font-semibold text-forest shadow-sm hover:bg-paper focus-visible:bg-paper"
              onClick={() => {
                const element = viewport.current
                if (element) {
                  element.scrollBy({
                    top: element.clientHeight * 0.75,
                    behavior: motionDuration(element) ? 'smooth' : 'instant',
                  })
                }
              }}
            >
              {t('scrollForMore')}
              <IconArrowDown className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
