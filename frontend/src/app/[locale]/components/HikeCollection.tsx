'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { HikeCard } from './HikeCard'

import { Eyebrow } from './Eyebrow'
import { Button } from '@/components/Button'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'

import type { Locale } from '@/i18n/routing'
import type { HikeSummary } from '@/lib/hikes'

const filters = ['all', 'completed', 'ongoing', 'planned', 'aborted'] as const

export function HikeCollection({ hikes, locale }: { hikes: HikeSummary[]; locale: Locale }) {
  const t = useTranslations('Site')
  const [filter, setFilter] = useState<(typeof filters)[number]>('all')
  const [page, setPage] = useState(1)
  const filtered = hikes.filter((hike) => filter === 'all' || hike.status === filter)
  const pages = Math.max(1, Math.ceil(filtered.length / 9))
  return (
    <section className="pt-9.5 pb-12.5 tablet:pt-15 tablet:pb-20">
      <Container>
        <div
          id="hikes"
          className="mb-7 flex flex-col items-start justify-between gap-6 desktop:flex-row desktop:items-end"
          tabIndex={-1}
        >
          <div>
            <Eyebrow className="mb-2.5">{t('collectionEyebrow')}</Eyebrow>
            <Heading as="h2" className="mb-2.5">
              {t('collection')}
            </Heading>
            <p className="text-muted">{t('count', { count: filtered.length })}</p>
          </div>
          <div className="flex flex-wrap gap-1.75" role="group" aria-label={t('filter')}>
            {filters.map((value) => (
              <Button
                variant="pill"
                key={value}
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value)
                  setPage(1)
                }}
              >
                {t(`filters.${value}`)}
              </Button>
            ))}
          </div>
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
            {filtered.slice((page - 1) * 9, page * 9).map((hike) => (
              <HikeCard key={hike.id} hike={hike} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="py-25 text-center">{t('empty')}</p>
        )}
        {pages > 1 && (
          <nav
            className="mt-8.75 flex items-center justify-center gap-2.5 text-action tablet:gap-5"
            aria-label={t('hikes')}
          >
            <Button
              variant="pill"
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1)
              }}
            >
              {t('previous')}
            </Button>
            <span>{t('page', { page, pages })}</span>
            <Button
              variant="pill"
              disabled={page === pages}
              onClick={() => {
                setPage(page + 1)
              }}
            >
              {t('next')}
            </Button>
          </nav>
        )}
      </Container>
    </section>
  )
}
