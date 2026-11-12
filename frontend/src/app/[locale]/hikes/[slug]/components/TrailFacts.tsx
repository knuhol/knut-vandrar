import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconArrowUpRight as ArrowUpRight } from '@tabler/icons-react'

import { TrailTags } from './TrailTags'
import { TrailRatings } from './TrailRatings'
import { TrailPracticalities } from './TrailPracticalities'

import { Heading } from '@/components/Heading'
import type { Locale } from '@/i18n/routing'
import { imageUrl } from '@/api/images'
import type { Hike } from '@/api/hikes'
import type { TrailTag, TrailRatings as Ratings } from '@/hiking/presentation'
import type { TrailDetails } from '@/hiking/details'

// Shared geographic facts support either a named trail or a hiking area.
type HikingLocation = NonNullable<Hike['location']>

function countryFlag(code: string) {
  return /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(code.charCodeAt(0) + 127_397, code.charCodeAt(1) + 127_397)
    : undefined
}

export function TrailFacts({
  location,
  locale,
  tags = [],
  ratings,
  details,
}: {
  location: HikingLocation
  locale: Locale
  tags?: TrailTag[]
  ratings?: Ratings
  details?: TrailDetails
}) {
  const t = useTranslations('Site')
  const countries = new Intl.DisplayNames([locale], { type: 'region' })
  const locationTags = [...new Set(tags)]

  return (
    <section className="min-w-0 rounded-lg border border-beige bg-cream p-5">
      <div className="mb-5">
        <Heading as="h2" className="text-xl">
          {t('trailOrArea')}
        </Heading>
      </div>

      <dl className="grid gap-4.5 [&_dd]:text-base">
        <div>
          <dt className="sr-only">{t('name')}</dt>
          <dd className="font-semibold text-forest">
            {location.official_url ? (
              <a
                className="link-dotted inline-flex items-center gap-1.5"
                href={location.official_url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {location.name}
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              location.name
            )}
          </dd>
        </div>
        {location.country_codes.length > 0 && (
          <div>
            <dt className="sr-only">{t('countries')}</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {location.country_codes.map((code) => (
                  <li
                    key={code}
                    className="inline-flex items-center gap-2 rounded-full border border-beige bg-paper px-3 py-1.5 text-sm text-forest"
                  >
                    <span aria-hidden="true">{countryFlag(code)}</span>
                    {countries.of(code) ?? code}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {locationTags.length > 0 && (
          <div>
            <dt className="sr-only">{t('trailTags.label')}</dt>
            <dd>
              <TrailTags
                tags={locationTags}
                regions={location.regions.map((region) => region.name)}
              />
            </dd>
          </div>
        )}
      </dl>
      {details && <TrailPracticalities details={details} locale={locale} />}
      {ratings && (
        <div className="mt-5 border-t border-beige pt-5">
          <TrailRatings ratings={ratings} />
        </div>
      )}
      {location.logo_url && (
        <div className="mt-5 flex justify-center border-t border-beige pt-5">
          <Image
            src={imageUrl(location.logo_url)}
            alt=""
            width={220}
            height={90}
            className="h-auto max-h-25 max-w-full object-contain"
            unoptimized
          />
        </div>
      )}
    </section>
  )
}
