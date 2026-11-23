import { IconInfoCircle } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { Disclosure } from '@/components/Disclosure/Disclosure'
import { Heading } from '@/components/Heading'
import { StarRating } from '@/components/StarRating'
import type { TrailRatings as Ratings } from '@/hiking/presentation'

const categories = [
  'facilities',
  'maintenance',
  'resupplies',
  'publicTransport',
  'difficulty',
] as const satisfies readonly (keyof Ratings)[]

export function TrailRatings({ ratings }: { ratings: Ratings }) {
  const t = useTranslations('Site.trailRatings')

  return (
    <section>
      <Heading as="h3" tone="brand">
        {t('title')}
      </Heading>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t('intro')}</p>
      <ul className="mt-4 grid gap-4">
        {categories
          .filter((category) => ratings[category] !== null)
          .map((category) => (
            <li key={category}>
              <Disclosure>
                <summary
                  className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm ${category === 'difficulty' ? 'text-orange-dark' : 'text-forest'} [&::-webkit-details-marker]:hidden`}
                >
                  <span className="font-semibold">{t(`${category}.label`)}</span>
                  <span className="sr-only">{t('moreInfo')}</span>
                  <IconInfoCircle className="size-5 shrink-0" aria-hidden="true" />
                </summary>
                <p className="pb-3 text-sm leading-relaxed text-muted">
                  {t(`${category}.description`)}
                </p>
              </Disclosure>
              <StarRating
                value={ratings[category] ?? 0}
                tone={category === 'difficulty' ? 'caution' : 'default'}
              />
            </li>
          ))}
      </ul>
    </section>
  )
}
