'use client'

import { IconX } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import styles from './VideoModal.module.css'

export function VideoModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const t = useTranslations('Site')
  const dialog = useRef<HTMLDialogElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const overflow = document.body.style.overflow
    const padding = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const currentPadding = Number.parseFloat(getComputedStyle(document.body).paddingRight)
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${String(currentPadding + scrollbar)}px`
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target !== element) return
      const bounds = element.getBoundingClientRect()
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        element.close()
    }
    element.addEventListener('click', closeOnBackdrop)
    element.showModal()
    return () => {
      element.removeEventListener('click', closeOnBackdrop)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = padding
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className={`m-auto max-h-(--modal-max-height) w-(--modal-width) max-w-none overflow-auto rounded-panel border border-(--modal-border) bg-forest p-0 text-cream shadow-modal ${styles.dialog}`}
      aria-label={t('youtube_video')}
      onClose={onClose}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span>{t('youtube_video')}</span>
        <button
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-action bg-(--modal-close-background) hover:bg-(--modal-close-hover)"
          type="button"
          aria-label={t('closeVideo')}
          onClick={() => {
            dialog.current?.close()
          }}
        >
          <IconX className="size-6 shrink-0" aria-hidden="true" />
        </button>
      </div>
      <div
        className="relative aspect-video overflow-hidden bg-forest text-cream"
        aria-busy={!loaded}
      >
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
    </dialog>
  )
}
