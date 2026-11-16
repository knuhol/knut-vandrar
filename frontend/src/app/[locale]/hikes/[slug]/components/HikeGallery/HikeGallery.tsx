'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { HikeSection } from '../HikeSection/HikeSection'

import { Button } from '@/components/Button'
import { MediaControl } from '@/components/MediaModal/MediaControl'
import { MediaModal } from '@/components/MediaModal/MediaModal'
import type { getPhotos } from '@/api/hikes'
import type { Locale } from '@/i18n/routing'
import { imageUrl } from '@/api/images'

type GalleryPage = Awaited<ReturnType<typeof getPhotos>>

type GalleryPhoto = {
  id: string
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

  const [loading, setLoading] = useState(false)
  const moving = useRef(false)

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
      <div className="flex h-full flex-col gap-2">
        <div
          className="relative min-h-0 flex-1 touch-pan-y"
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
        </div>
        <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <MediaControl
            action="previous"
            label={t('previous')}
            disabled={loading || index === 0}
            onClick={() => {
              void move(-1)
            }}
          />
          <div className="grid min-w-0 gap-1 text-center" aria-live="polite" aria-atomic="true">
            <p className="text-xs font-semibold text-beige">
              {t('position', { current: index + 1, total })}
            </p>
            {(error || photo.caption) && (
              <p className="max-h-20 overflow-y-auto text-sm leading-relaxed">
                {error ? t('loadError') : photo.caption}
              </p>
            )}
          </div>
          <MediaControl
            action="next"
            label={t('next')}
            disabled={loading || (!hasMore && index === photos.length - 1)}
            onClick={() => {
              void move(1)
            }}
          />
        </div>
      </div>
    </MediaModal>
  )
}

export function HikeGallery({
  initialPage,
  hikeId,
  locale,
}: {
  initialPage: GalleryPage
  hikeId: string
  locale: Locale
}) {
  const t = useTranslations('Site.gallery')
  const [page, setPage] = useState(initialPage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const photos: GalleryPhoto[] = page.items.map((photo) => ({
    id: photo.id,
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
    <HikeSection id="photos" title={t('title')} meta={t('count', { count: page.total })}>
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 tablet:gap-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="card-interactive relative aspect-[4/3] cursor-pointer overflow-hidden rounded-sm bg-beige outline-none"
            aria-label={t('open', { number: index + 1, description: photo.alt })}
            aria-haspopup="dialog"
            onClick={() => {
              setSelectedIndex(index)
            }}
          >
            <Image
              src={photo.thumbnailSrc}
              alt={photo.alt}
              fill
              className="object-cover"
              sizes="(min-width: 641px) 33vw, 50vw"
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
