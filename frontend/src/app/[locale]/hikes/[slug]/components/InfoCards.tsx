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
import type { VisibleHikeCard } from '@/hiking/presentation'

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
  const parsed = URL.parse(url)

  if (!parsed) {
    return undefined
  }

  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    return id && /^[\w-]{11}$/.test(id) ? id : undefined
  }

  if (
    ![
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com',
    ].includes(parsed.hostname)
  ) {
    return undefined
  }

  const id = parsed.searchParams.get('v') ?? parsed.pathname.split('/').at(-1)
  return id && /^[\w-]{11}$/.test(id) ? id : undefined
}

export function InfoCards({
  cards,
  mapSharePassword,
  mapShareUrl,
  hikeId,
  hikeTitle,
  locale,
}: {
  cards: VisibleHikeCard[]
  mapSharePassword?: string
  mapShareUrl?: string
  hikeId: string
  hikeTitle: string | null
  locale: Locale
}) {
  const t = useTranslations('Site')
  const [playing, setPlaying] = useState<string>()

  if (cards.length === 0) {
    return null
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-1">
        {cards.map((card) => {
          const Icon = icons[card.type]

          if (card.type === 'youtube_video') {
            const id = youtubeId(card.url)

            return (
              <InfoCard
                key={card.type}
                icon={<Play aria-hidden="true" />}
                title={t('resourceTitles.youtube_video')}
                description={t('resourceDescriptions.youtube_video')}
                href={id ? undefined : card.url}
                onActivate={() => {
                  trackHikeInteraction({ name: 'video_open', hikeId, hikeTitle, locale })
                }}
                onClick={
                  id
                    ? () => {
                        if (playing) {
                          return
                        }
                        setPlaying(id)
                      }
                    : undefined
                }
                expanded={Boolean(playing)}
                emphasis="film"
              />
            )
          }

          const href = card.type === 'live_position' ? mapShareUrl : card.url
          const inactive = card.type === 'live_position' && (card.state === 'inactive' || !href)

          const resource = (
            <InfoCard
              key={card.type}
              icon={<Icon aria-hidden="true" />}
              title={t(`resourceTitles.${card.type}`)}
              inactive={inactive}
              onActivate={() => {
                trackHikeInteraction({
                  name: 'hike_resource_click',
                  hikeId,
                  hikeTitle,
                  locale,
                  resourceType: card.type,
                })
              }}
              href={href ?? undefined}
              description={inactive ? t('inactive') : t(`resourceDescriptions.${card.type}`)}
            />
          )
          return card.type === 'live_position' && !inactive && mapSharePassword ? (
            <div key={card.type} className="grid gap-3">
              <TrackingPassword key={mapSharePassword} password={mapSharePassword} />
              {resource}
            </div>
          ) : (
            resource
          )
        })}
      </div>
      {playing && (
        <VideoModal
          videoId={playing}
          onClose={() => {
            setPlaying(undefined)
          }}
        />
      )}
    </>
  )
}
