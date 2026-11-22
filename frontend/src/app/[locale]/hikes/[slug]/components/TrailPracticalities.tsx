import { IconFountain, IconBuildingStore, IconRipple, IconInfoCircle } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

import { AccommodationOptions } from './AccommodationOptions'
import { FactTag } from './FactTag'
import { FactItems } from './FactItems'

import { Heading } from '@/components/Heading'
import type { TrailDetails } from '@/hiking/details'
import type { Locale } from '@/i18n/routing'

const noteLines = (text: string | null) =>
  text
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean) ?? []

const waterIcons = { tap: IconFountain, shop: IconBuildingStore, natural: IconRipple }

export function TrailPracticalities({
  details,
  locale,
}: {
  details: TrailDetails
  locale: Locale
}) {
  const t = useTranslations('Site.practicalities')
  const overnightNotes = noteLines(details.overnightNote)
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const fullMonthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })

  if (
    details.hikingMonths.length === 0 &&
    details.waterSources.length === 0 &&
    details.overnightOptions.length === 0 &&
    details.overnightRestrictions.length === 0 &&
    !details.seasonNote &&
    overnightNotes.length === 0
  ) {
    return null
  }

  return (
    <div className="grid min-w-0 gap-5">
      {details.hikingMonths.length > 0 && (
        <section>
          <div className="mb-4">
            <Heading as="h3" tone="brand">
              {t('season')}
            </Heading>
          </div>
          <ul className="grid grid-cols-6 gap-1" aria-label={t('season')}>
            {Array.from({ length: 12 }, (_, index) => {
              const date = new Date(Date.UTC(2000, index, 1))
              const selected = details.hikingMonths.includes(index + 1)

              return (
                <li
                  key={date.toISOString()}
                  aria-label={t(selected ? 'inSeason' : 'outsideSeason', {
                    month: fullMonthFormatter.format(date),
                  })}
                >
                  <FactTag state={selected ? 'selected' : 'muted'} size="month">
                    {monthFormatter.format(date)}
                  </FactTag>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t('seasonNote')}</p>
        </section>
      )}
      {noteLines(details.seasonNote).map((note) => (
        <p key={note} className="text-sm leading-relaxed text-muted">
          {note}
        </p>
      ))}
      {details.waterSources.length > 0 && (
        <section>
          <div className="mb-4">
            <Heading as="h3" tone="brand">
              {t('water')}
            </Heading>
          </div>
          <FactItems
            items={details.waterSources.map((source) => {
              const Icon = waterIcons[source]

              return { id: source, label: t(`waterSources.${source}`), icon: <Icon /> }
            })}
          />
        </section>
      )}
      {details.overnightOptions.length > 0 && (
        <section>
          <div className="mb-4">
            <Heading as="h3" tone="brand">
              {t('overnights')}
            </Heading>
          </div>
          <AccommodationOptions options={details.overnightOptions.map((type) => ({ type }))} />
        </section>
      )}
      {(details.overnightRestrictions.length > 0 || overnightNotes.length > 0) && (
        <section>
          <div className="mb-4">
            <Heading as="h3" tone="brand">
              {t('restrictionsLabel')}
            </Heading>
          </div>
          <div className="flex items-start gap-2 text-sm leading-relaxed text-muted">
            <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              {details.overnightRestrictions.length > 0 && (
                <ul className="grid gap-2">
                  {details.overnightRestrictions.map((restriction) => (
                    <li key={restriction}>{t(`restrictions.${restriction}`)}</li>
                  ))}
                </ul>
              )}
              {overnightNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
