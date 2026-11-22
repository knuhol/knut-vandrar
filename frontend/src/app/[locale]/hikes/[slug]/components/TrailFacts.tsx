import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconArrowUpRight as ArrowUpRight } from '@tabler/icons-react'

import { HikeBadge } from './HikeBadge'
import { TrailTags } from './TrailTags'
import { TrailRatings } from './TrailRatings'
import { TrailPracticalities } from './TrailPracticalities'

import { HikeSection } from './HikeSection/HikeSection'
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
  presentation = 'section',
}: {
  location: HikingLocation
  locale: Locale
  tags?: TrailTag[]
  ratings?: Ratings
  details?: TrailDetails
  presentation?: 'section' | 'footer'
}) {
  const t = useTranslations('Site')
  const countries = new Intl.DisplayNames([locale], { type: 'region' })
  const locationTags = [...new Set(tags)]

  return (
    <HikeSection
      id="trail"
      title={t(`locationKind.${location.kind}`)}
      variant={presentation === 'footer' ? 'plain' : 'paper'}
      heading={presentation === 'footer' ? 'prominent' : 'visible'}
    >
      {presentation === 'footer' && (
        <p className="mb-8 max-w-reading text-base leading-relaxed text-forest">
          {t(location.kind === 'trail' ? 'trailGeneralIntro' : 'areaGeneralIntro')}
        </p>
      )}
      <div className="mb-8 grid items-center gap-8 tablet:grid-cols-2">
        <div className={location.logo_url ? 'min-w-0' : 'min-w-0 tablet:col-span-2'}>
          <dl className="grid gap-4.5 [&_dd]:text-base">
            <div>
              <dt className="sr-only">{t('name')}</dt>
              <dd className="font-display text-xl leading-tight font-bold text-forest">
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
                      <li key={code} className="max-w-full">
                        <HikeBadge kind="country">
                          <span aria-hidden="true">{countryFlag(code)}</span>
                          {countries.of(code) ?? code}
                        </HikeBadge>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
          {(locationTags.length > 0 || location.regions.length > 0) && (
            <div className="mt-4.5">
              <TrailTags
                tags={locationTags}
                regions={location.regions.map((region) => region.name)}
              />
            </div>
          )}
        </div>
        {location.logo_url && (
          <div className="flex min-w-0 w-full h-full items-end">
            <Image
              src={imageUrl(location.logo_url)}
              alt=""
              width={320}
              height={160}
              sizes="(min-width: 641px) 33vw, 100vw"
              className="block h-auto max-h-25 tablet:max-h-30 w-full max-w-80 tablet:max-w-100 object-contain object-left"
              unoptimized
            />
          </div>
        )}
      </div>
      <div className="grid items-start gap-8 tablet:grid-cols-2">
        {details && <TrailPracticalities details={details} locale={locale} />}
        {ratings && (
          <div className="min-w-0">
            <TrailRatings ratings={ratings} />
          </div>
        )}
      </div>
    </HikeSection>
  )
}
