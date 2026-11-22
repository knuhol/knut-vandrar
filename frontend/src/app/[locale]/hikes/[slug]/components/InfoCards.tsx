'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  IconPlayerPlayFilled as Play,
  IconMap as Map,
  IconBackpack as Backpack,
  IconMapPin as MapPin,
  IconChartBar as ChartNoAxesColumn,
  IconCamera as Camera,
  IconRoute as Route,
} from '@tabler/icons-react'

import { VideoModal } from './VideoModal/VideoModal'

import { InfoCard } from './InfoCard'
import { TrackingPassword } from './TrackingPassword'

import { trackHikeInteraction } from '@/analytics/hikeEvents'
import type { Locale } from '@/i18n/routing'
import type { Hike } from '@/api/hikes'

const icons = {
  route: Map,
  gpx_collection: Route,
  progress: ChartNoAxesColumn,
  live_position: MapPin,
  equipment: Backpack,
  social_feed: Camera,
  youtube_video: Play,
}

function youtubeId(url: string) {
  const parsed = new URL(url)

  if (parsed.hostname === 'youtu.be') {
    return parsed.pathname.slice(1).split('/')[0]
  }

  return parsed.searchParams.get('v') ?? parsed.pathname.split('/').at(-1)
}

export function InfoCards({
  cards,
  hikeId,
  hikeTitle,
  locale,
  presentation = 'cards',
}: {
  cards: Hike['cards']
  hikeId: string
  hikeTitle: string | null
  locale: Locale
  presentation?: 'cards' | 'compact'
}) {
  const t = useTranslations('Site')
  const [playing, setPlaying] = useState<{ key: string; id: string }>()

  if (cards.length === 0) {
    return null
  }

  const ordered =
    presentation === 'compact'
      ? cards.toSorted((a, b) => {
          const priority = (type: string) =>
            type === 'youtube_video' ? 0 : type === 'equipment' ? 1 : 2
          return priority(a.type) - priority(b.type)
        })
      : cards

  return (
    <>
      {cards.map((card, index) =>
        card.type === 'live_position' && card.state === 'active' && card.url && card.password ? (
          <TrackingPassword key={`${String(index)}-${card.password}`} password={card.password} />
        ) : null,
      )}
      <div
        className={
          presentation === 'compact'
            ? 'grid gap-2'
            : 'grid grid-cols-1 items-stretch gap-4 tablet:grid-cols-2 desktop:grid-cols-3'
        }
      >
        {ordered.map((card, index) => {
          const Icon = icons[card.type]
          const key = `${card.type}-${String(index)}`

          if (card.type === 'youtube_video') {
            const id = youtubeId(card.url)

            if (!id || !/^[\w-]{11}$/.test(id)) {
              return (
                <InfoCard
                  key={key}
                  icon={<Play aria-hidden="true" />}
                  title={t(presentation === 'compact' ? 'watchFilm' : 'youtube_video')}
                  onActivate={() => {
                    trackHikeInteraction({ name: 'video_open', hikeId, hikeTitle, locale })
                  }}
                  emphasis="film"
                  variant={presentation === 'compact' ? 'compact' : 'video'}
                  href={card.url}
                  action={t(
                    presentation === 'compact' ? 'resourceDescriptions.youtube_video' : 'video',
                  )}
                />
              )
            }

            return (
              <InfoCard
                key={key}
                icon={<Play aria-hidden="true" />}
                title={t(presentation === 'compact' ? 'watchFilm' : 'youtube_video')}
                action={t(
                  presentation === 'compact' ? 'resourceDescriptions.youtube_video' : 'video',
                )}
                onClick={() => {
                  if (playing?.key === key) {
                    return
                  }
                  trackHikeInteraction({ name: 'video_open', hikeId, hikeTitle, locale })
                  setPlaying({ key, id })
                }}
                expanded={playing?.key === key}
                emphasis="film"
                variant={presentation === 'compact' ? 'compact' : 'video'}
              />
            )
          }

          const inactive = card.type === 'live_position' && (card.state === 'inactive' || !card.url)

          return (
            <InfoCard
              key={key}
              icon={<Icon aria-hidden="true" />}
              title={t(presentation === 'compact' ? `cardActions.${card.type}` : card.type)}
              emphasis={card.type === 'equipment' ? 'equipment' : 'standard'}
              variant={presentation === 'compact' ? 'compact' : 'default'}
              inactive={inactive}
              message={inactive ? t('inactive') : undefined}
              onActivate={() => {
                trackHikeInteraction({
                  name: 'hike_resource_click',
                  hikeId,
                  hikeTitle,
                  locale,
                  resourceType: card.type,
                })
              }}
              href={card.url ?? undefined}
              action={t(
                presentation === 'compact'
                  ? `resourceDescriptions.${card.type}`
                  : `cardActions.${card.type}`,
              )}
            />
          )
        })}
      </div>
      {playing && (
        <VideoModal
          videoId={playing.id}
          onClose={() => {
            setPlaying(undefined)
          }}
        />
      )}
    </>
  )
}
