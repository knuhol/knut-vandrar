'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import styles from './VideoModal.module.css'

import { MediaModal } from '@/components/MediaModal/MediaModal'

export function VideoModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const t = useTranslations('Site')
  const [loaded, setLoaded] = useState(false)

  return (
    <MediaModal title={t('youtube_video')} closeLabel={t('closeVideo')} onClose={onClose}>
      <div className="relative h-full w-full overflow-hidden bg-ink text-cream" aria-busy={!loaded}>
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center" role="status">
            <div
              className={`absolute inset-x-0 top-0 h-0.75 overflow-hidden bg-sage ${styles.loadingBar}`}
              aria-hidden="true"
            />
            <span>{t('videoLoading')}</span>
          </div>
        )}
        <iframe
          className={`block h-full w-full border-0 ${styles.player} ${loaded ? 'opacity-100' : 'opacity-0'}`}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={t('youtube_video')}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => {
            setLoaded(true)
          }}
        />
      </div>
    </MediaModal>
  )
}
