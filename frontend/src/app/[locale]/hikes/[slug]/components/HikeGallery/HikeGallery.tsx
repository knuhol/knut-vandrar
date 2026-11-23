'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { HikeSection } from '../HikeSection/HikeSection'

import styles from './HikeGallery.module.css'

import { responsiveMedia } from '@/config/breakpoints'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { Button } from '@/components/Button'
import { MediaControl } from '@/components/MediaModal/MediaControl'
import { MediaModal } from '@/components/MediaModal/MediaModal'
import type { getPhotos } from '@/api/hikes'
import type { Locale } from '@/i18n/routing'
import { imageUrl } from '@/api/images'

type GalleryPage = Awaited<ReturnType<typeof getPhotos>>

type GalleryPhoto = {
  id: string
  width: number
  height: number
  thumbnailSrc: string
  src: string
  alt: string
  caption?: string
}

function PhotoViewer({
  photos,
  initialIndex,
  onClose,
  hasMore,
  loadMore,
  total,
  error,
}: {
  photos: readonly GalleryPhoto[]
  initialIndex: number
  error: boolean
  total: number
  hasMore: boolean
  loadMore: () => Promise<boolean>
  onClose: () => void
}) {
  const t = useTranslations('Site.gallery')
  const touchStart = useRef<number | null>(null)
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]
  const viewport = useRef<HTMLDivElement>(null)
  const imageFrame = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLDivElement>(null)
  const [captionFitsBelow, setCaptionFitsBelow] = useState(false)
  const [previousFitsOutside, setPreviousFitsOutside] = useState(false)
  const [nextFitsOutside, setNextFitsOutside] = useState(false)
  const showCaption = Boolean(error || photo.caption)

  const [loading, setLoading] = useState(false)
  const moving = useRef(false)

  useEffect(() => {
    const viewer = viewport.current
    const frame = imageFrame.current
    const text = caption.current
    const previousArrow = previous.current
    const nextArrow = next.current
    if (
      !viewer ||
      !frame ||
      !previousArrow ||
      !nextArrow ||
      typeof ResizeObserver === 'undefined'
    ) {
      return
    }

    const observer = new ResizeObserver(() => {
      const viewerBounds = viewer.getBoundingClientRect()
      const imageBounds = frame.getBoundingClientRect()
      const captionHeight = text?.getBoundingClientRect().height ?? 0
      const previousWidth = previousArrow.getBoundingClientRect().width
      const nextWidth = nextArrow.getBoundingClientRect().width
      setCaptionFitsBelow(
        captionHeight > 0 && captionHeight <= viewerBounds.bottom - imageBounds.bottom,
      )
      setPreviousFitsOutside(
        previousWidth > 0 && previousWidth <= imageBounds.left - viewerBounds.left,
      )
      setNextFitsOutside(nextWidth > 0 && nextWidth <= viewerBounds.right - imageBounds.right)
    })
    observer.observe(viewer)
    observer.observe(frame)
    observer.observe(previousArrow)
    observer.observe(nextArrow)
    if (text) {
      observer.observe(text)
    }
    return () => {
      observer.disconnect()
    }
  }, [showCaption])

  async function move(direction: number) {
    if (moving.current || index + direction < 0) {
      return
    }
    if (index + direction < photos.length) {
      setIndex(index + direction)
    } else if (hasMore) {
      moving.current = true
      setLoading(true)
      try {
        if (await loadMore()) {
          setIndex(index + direction)
        }
      } finally {
        moving.current = false
        setLoading(false)
      }
    }
  }

  return (
    <MediaModal
      title={t('title')}
      closeLabel={t('close')}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          void move(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
    >
      <div ref={viewport} className="relative grid h-full w-full place-items-center">
        <div
          ref={imageFrame}
          className="relative touch-pan-y"
          style={{
            aspectRatio: `${String(photo.width)} / ${String(photo.height)}`,
            width: `min(100%, calc(100dvh * ${String(photo.width / photo.height)}))`,
          }}
          onTouchStart={(event) => {
            touchStart.current = event.changedTouches[0].clientX
          }}
          onTouchEnd={(event) => {
            if (touchStart.current !== null) {
              const distance = event.changedTouches[0].clientX - touchStart.current
              if (Math.abs(distance) > 50) {
                void move(distance > 0 ? -1 : 1)
              }
            }
            touchStart.current = null
          }}
          onTouchCancel={() => {
            touchStart.current = null
          }}
        >
          <Image
            key={photo.id}
            src={photo.src}
            alt={photo.alt}
            sizes="100vw"
            fill
            className="object-contain"
            unoptimized
          />
          <div
            ref={previous}
            className={`${styles.previous} absolute top-1/2 flex w-max -translate-y-1/2 ${previousFitsOutside ? 'right-full' : 'left-0'}`}
          >
            <MediaControl
              action="previous"
              label={t('previous')}
              disabled={loading || index === 0}
              onClick={() => {
                void move(-1)
              }}
            />
          </div>
          <div
            ref={next}
            className={`${styles.next} absolute top-1/2 flex w-max -translate-y-1/2 ${nextFitsOutside ? 'left-full' : 'right-0'}`}
          >
            <MediaControl
              action="next"
              label={t('next')}
              disabled={loading || (!hasMore && index === photos.length - 1)}
              onClick={() => {
                void move(1)
              }}
            />
          </div>
          {showCaption && (
            <div
              ref={caption}
              className={`${styles.caption} absolute inset-x-0 text-center ${captionFitsBelow && !error ? 'top-full' : 'bottom-0'}`}
            >
              <p
                className={`${styles.overlayText} inline-block max-h-[50dvh] overflow-y-auto`}
                role={error ? 'alert' : undefined}
              >
                {error ? t('loadError') : photo.caption}
              </p>
            </div>
          )}
        </div>
        <p
          className={`${styles.overlayText} ${styles.counter} absolute`}
          aria-live="polite"
          aria-atomic="true"
        >
          {t('position', { current: index + 1, total })}
        </p>
      </div>
    </MediaModal>
  )
}

export function HikeGallery({
  initialPage,
  hikeId,
  hikeTitle,
  locale,
}: {
  initialPage: GalleryPage
  hikeId: string
  hikeTitle: string | null
  locale: Locale
}) {
  const t = useTranslations('Site.gallery')
  const [page, setPage] = useState(initialPage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const photos: GalleryPhoto[] = page.items.map((photo) => ({
    id: photo.id,
    width: photo.width,
    height: photo.height,
    src: imageUrl(photo.image_url),
    thumbnailSrc: imageUrl(photo.thumbnail_url),
    alt: photo.alt || t('defaultAlt'),
    caption: photo.caption?.trim() || photo.alt.trim() || undefined,
  }))
  const hasMore = page.items.length < page.total

  async function loadMore() {
    setBusy(true)
    setError(false)
    try {
      const response = await fetch(
        imageUrl(`/api/hikes/${hikeId}/photos`) +
          `?locale=${locale}&limit=24&offset=${String(page.items.length)}`,
      )
      if (!response.ok) {
        throw new Error('Gallery request failed')
      }
      const next = (await response.json()) as GalleryPage
      setPage((current) => ({ ...next, items: [...current.items, ...next.items] }))
      return next.items.length > 0
    } catch {
      setError(true)
      return false
    } finally {
      setBusy(false)
    }
  }
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return null
  }

  return (
    <HikeSection
      id="photos"
      title={t('title')}
      heading="hidden"
      meta={t('count', { count: page.total })}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="card-interactive relative aspect-[4/3] cursor-pointer overflow-hidden rounded-sm bg-beige outline-none"
            aria-label={t('open', { number: index + 1, description: photo.alt })}
            aria-haspopup="dialog"
            onClick={() => {
              trackHikeInteraction({ name: 'gallery_open', hikeId, hikeTitle, locale })
              setSelectedIndex(index)
            }}
          >
            <Image
              src={photo.thumbnailSrc}
              alt={photo.alt}
              fill
              className="object-cover"
              sizes={`${responsiveMedia.wide} 25vw, ${responsiveMedia.tablet} 33vw, 50vw`}
              unoptimized
            />
          </button>
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            size="small"
            disabled={busy}
            onClick={() => {
              void loadMore()
            }}
          >
            {t('showMore')}
          </Button>
        </div>
      )}
      {error && <p role="alert">{t('loadError')}</p>}
      {selectedIndex !== null && (
        <PhotoViewer
          photos={photos}
          hasMore={hasMore}
          total={page.total}
          error={error}
          loadMore={loadMore}
          initialIndex={selectedIndex}
          onClose={() => {
            setSelectedIndex(null)
          }}
        />
      )}
    </HikeSection>
  )
}
