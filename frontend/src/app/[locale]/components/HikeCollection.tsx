import { useTranslations } from 'next-intl'

import { HikeCard } from './HikeCard'
import { Eyebrow } from '@/components/Eyebrow'
import { Pill, PillLink } from '@/components/Pill'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'
import type { HikesPage } from '@/api/hikes'
import { hikeCategories, type HikeCategory } from '@/hiking/categories'
import { collectionQuery } from '@/hiking/pagination'

export function HikeCollection({ pages }: { pages: Record<HikeCategory, HikesPage> }) {
  const t = useTranslations('Site')
  const offsets = { offset: pages.long_distance.offset, multiDayOffset: pages.multi_day.offset }

  return (
    <div id="hikes" tabIndex={-1} className="pt-9.5 pb-12.5 outline-none tablet:pt-15 tablet:pb-20">
      <Container>
        <div className="grid gap-12.5 tablet:gap-20">
          {hikeCategories.map((category) => {
            const page = pages[category.key]
            const pagination = [
              {
                label: 'previous',
                offset: page.offset > 0 ? Math.max(0, page.offset - page.limit) : undefined,
              },
              {
                label: 'next',
                offset:
                  page.offset + page.items.length < page.total
                    ? page.offset + page.limit
                    : undefined,
              },
            ] as const

            return (
              <section key={category.id} aria-labelledby={`${category.id}-title`}>
                <div id={category.id} tabIndex={-1} className="mb-7 outline-none">
                  <div className="mb-2.5">
                    <Eyebrow>{t('collectionEyebrow')}</Eyebrow>
                  </div>
                  <div className="mb-2.5">
                    <Heading as="h2" id={`${category.id}-title`}>
                      {t(category.title)}
                    </Heading>
                  </div>
                  <p className="text-muted">{t('count', { count: page.total })}</p>
                </div>
                {page.items.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
                    {page.items.map((hike) => (
                      <HikeCard key={hike.id} hike={hike} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">{t('empty')}</p>
                )}
                {(page.offset > 0 || page.total > page.limit) && (
                  <nav
                    className="mt-8.75 flex items-center justify-center gap-5 text-base"
                    aria-label={t(category.title)}
                  >
                    {pagination.map(({ label, offset }) => {
                      const next = { ...offsets, [category.offsetKey]: offset ?? 0 }
                      return offset === undefined ? (
                        <Pill key={label} disabled>
                          {t(label)}
                        </Pill>
                      ) : (
                        <PillLink
                          key={label}
                          href={{
                            pathname: '/',
                            query: collectionQuery(next.offset, next.multiDayOffset),
                            hash: category.id,
                          }}
                          prefetch={false}
                        >
                          {t(label)}
                        </PillLink>
                      )
                    })}
                  </nav>
                )}
              </section>
            )
          })}
        </div>
      </Container>
    </div>
  )
}
