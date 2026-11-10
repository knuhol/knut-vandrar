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

import { VideoModal } from './VideoModal'

import { InfoCard } from './InfoCard'

import type { Hike } from '@/lib/hikes'

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
  if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('/')[0]
  return parsed.searchParams.get('v') ?? parsed.pathname.split('/').at(-1)
}

export function InfoCards({ cards }: { cards: Hike['cards'] }) {
  const t = useTranslations('Site')
  const [playing, setPlaying] = useState<{ key: string; id: string }>()
  return (
    <>
      <section className="grid grid-cols-1 items-stretch gap-5 tablet:grid-cols-2 desktop:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = icons[card.type]
          const key = `${card.type}-${String(index)}`
          if (card.type === 'youtube_video') {
            const id = youtubeId(card.url)
            if (!id || !/^[\w-]{11}$/.test(id))
              return (
                <InfoCard
                  key={key}
                  icon={<Play className="size-6 shrink-0" aria-hidden="true" />}
                  title={t('youtube_video')}
                  href={card.url}
                  action={t('video')}
                />
              )
            return (
              <div
                className="min-h-36 rounded-panel border border-line overflow-hidden bg-forest text-cream"
                key={key}
              >
                <button
                  type="button"
                  className="grid h-full w-full cursor-pointer grid-cols-[var(--video-icon-size)_minmax(0,1fr)] content-center items-center gap-3 bg-transparent p-6 text-left aria-expanded:bg-forest-dark"
                  onClick={() => {
                    if (playing?.key === key) return
                    setPlaying({ key, id })
                  }}
                  aria-label={t('video')}
                  aria-expanded={playing?.key === key}
                  aria-haspopup="dialog"
                >
                  <Play className="row-span-2 size-9 shrink-0" aria-hidden="true" />
                  <span className="font-display leading-video font-bold">{t('youtube_video')}</span>
                  <small className="col-start-2 opacity-75">{t('videoProvider')}</small>
                </button>
              </div>
            )
          }
          const inactive = card.type === 'live_position' && (card.state === 'inactive' || !card.url)
          return (
            <InfoCard
              key={key}
              icon={<Icon className="size-6 shrink-0" aria-hidden="true" />}
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
