import { useTranslations } from 'next-intl'

import { HikeCard } from './HikeCard'
import { Eyebrow } from './Eyebrow'

import { Pill, PillLink } from '@/components/Pill'
import { Container } from '@/components/Container'
import { Heading } from '@/components/Heading'
import type { HikesPage } from '@/api/hikes'

export function HikeCollection({ page }: { page: HikesPage }) {
  const t = useTranslations('Site')
  const pagination = [
    {
      label: 'previous',
      offset: page.offset > 0 ? Math.max(0, page.offset - page.limit) : undefined,
    },
    {
      label: 'next',
      offset:
        page.items.length > 0 && page.offset + page.items.length < page.total
          ? page.offset + page.limit
          : undefined,
    },
  ] as const

  return (
    <section className="pt-9.5 pb-12.5 tablet:pt-15 tablet:pb-20">
      <Container>
        <div id="hikes" className="mb-7" tabIndex={-1}>
          <Eyebrow className="mb-2.5">{t('collectionEyebrow')}</Eyebrow>
          <div className="mb-2.5">
            <Heading as="h2">{t('collection')}</Heading>
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
          <p className="py-25 text-center">{t('empty')}</p>
        )}
        {(page.offset > 0 || page.total > page.limit) && (
          <nav
            className="mt-8.75 flex items-center justify-center gap-5 text-base"
            aria-label={t('hikes')}
          >
            {pagination.map(({ label, offset }) =>
              offset === undefined ? (
                <Pill key={label} disabled>
                  {t(label)}
                </Pill>
              ) : (
                <PillLink
                  key={label}
                  href={{
                    pathname: '/',
                    query: offset === 0 ? {} : { offset },
                    hash: 'hikes',
                  }}
                  prefetch={false}
                >
                  {t(label)}
                </PillLink>
              ),
            )}
          </nav>
        )}
      </Container>
    </section>
  )
}
