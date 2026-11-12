'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  IconPlayerPlay as Play,
  IconMap as Map,
  IconBackpack as Backpack,
  IconMapPin as MapPin,
  IconChartBar as ChartNoAxesColumn,
  IconCamera as Camera,
} from '@tabler/icons-react'

import { VideoModal } from './VideoModal/VideoModal'

import { InfoCard } from './InfoCard'

import type { Hike } from '@/api/hikes'

const icons = {
  route: Map,
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

export function InfoCards({ cards }: { cards: Hike['cards'] }) {
  const t = useTranslations('Site')
  const [playing, setPlaying] = useState<{ key: string; id: string }>()

  if (cards.length === 0) {
    return null
  }

  return (
    <>
      <section
        className={`grid grid-cols-1 items-stretch gap-4 ${cards.length > 1 ? 'tablet:grid-cols-2 desktop:grid-cols-1' : ''}`}
      >
        {cards.map((card, index) => {
          const Icon = icons[card.type]
          const key = `${card.type}-${String(index)}`

          if (card.type === 'youtube_video') {
            const id = youtubeId(card.url)

            if (!id || !/^[\w-]{11}$/.test(id)) {
              return (
                <InfoCard
                  key={key}
                  icon={<Play aria-hidden="true" />}
                  title={t('youtube_video')}
                  href={card.url}
                  action={t('video')}
                />
              )
            }

            return (
              <InfoCard
                key={key}
                icon={<Play aria-hidden="true" />}
                title={t('youtube_video')}
                action={t('video')}
                onClick={() => {
                  if (playing?.key === key) {
                    return
                  }
                  setPlaying({ key, id })
                }}
                expanded={playing?.key === key}
                variant="video"
              />
            )
          }

          const inactive = card.type === 'live_position' && (card.state === 'inactive' || !card.url)

          return (
            <InfoCard
              key={key}
              icon={<Icon aria-hidden="true" />}
              title={t(card.type)}
              inactive={inactive}
              message={inactive ? t('inactive') : undefined}
              href={card.url ?? undefined}
              action={t(`cardActions.${card.type}`)}
            />
          )
        })}
      </section>
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
