'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { HikeSection } from '../HikeSection/HikeSection'

import styles from './HikeGallery.module.css'

import { responsiveMedia } from '@/config/breakpoints'
import { trackHikeInteraction } from '@/analytics/hikeEvents'
import { Button } from '@/components/Button'
import { RevealImage } from '@/components/RevealImage'
import { MediaControl } from '@/components/MediaModal/MediaControl'
import { MediaModal } from '@/components/MediaModal/MediaModal'
import type { getPhotos } from '@/api/hikes'
import type { Locale } from '@/i18n/routing'
import { imageUrl } from '@/api/images'
import { useCharacterShortcutsEnabled } from '@/navigation/shortcutPreferences'
import { useClickShortcut } from '@/navigation/usePageShortcut'

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

function photoFrameStyle(photo: GalleryPhoto) {
  return {
    aspectRatio: `${String(photo.width)} / ${String(photo.height)}`,
    width: `min(100%, calc(100dvh * ${String(photo.width / photo.height)}))`,
  }
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
  loadMore: (throughEnd?: boolean) => Promise<number | null>
  onClose: () => void
}) {
  const t = useTranslations('Site.gallery')
  const touchStart = useRef<number | null>(null)
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]
  const [slide, setSlide] = useState<{
    from: number
    direction: number
    captionBelow: boolean
  } | null>(null)
  const [loadedSource, setLoadedSource] = useState<string | null>(null)
  const sliding = slide !== null && loadedSource === photo.src
  const displayedPhotos = slide ? [photos[slide.from], photo] : [photo]
  const prefetched = useRef(new Set<string>())
  const previousSource = photos[index - 1]?.src
  const nextSource = photos[index + 1]?.src
  const followingSource = photos[index + 2]?.src
  const viewport = useRef<HTMLDivElement>(null)
  const imageFrame = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLDivElement>(null)
  const [captionLayout, setCaptionLayout] = useState<{ id: string; below: boolean } | null>(null)
  const captionFitsBelow = captionLayout?.id === photo.id && captionLayout.below && !error
  const [previousFitsOutside, setPreviousFitsOutside] = useState(false)
  const [nextFitsOutside, setNextFitsOutside] = useState(false)
  const showCaption = Boolean(error || photo.caption)

  const [loading, setLoading] = useState(false)
  const moving = useRef(false)

  useEffect(() => {
    const requested = prefetched.current
    for (const source of [nextSource, previousSource, followingSource]) {
      if (!source || requested.has(source)) {
        continue
      }
      const image = new window.Image()
      image.fetchPriority = 'low'
      image.addEventListener(
        'error',
        () => {
          requested.delete(source)
        },
        { once: true },
      )
      requested.add(source)
      image.src = source
    }
  }, [nextSource, previousSource, followingSource])

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
      const below = captionHeight > 0 && captionHeight <= viewerBounds.bottom - imageBounds.bottom
      setCaptionLayout((current) =>
        current?.id === photo.id && current.below === below ? current : { id: photo.id, below },
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
  }, [photo.id, showCaption])

  function showPhoto(nextIndex: number, direction: number) {
    const visibleIndex = slide && !sliding ? slide.from : index
    const animate =
      nextIndex !== visibleIndex && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const captionBelow = slide && !sliding ? slide.captionBelow : captionFitsBelow
    setSlide(animate ? { from: visibleIndex, direction, captionBelow } : null)
    setIndex(nextIndex)
  }

  async function goTo(destination: number | 'last') {
    const nextIndex = destination === 'last' ? total - 1 : destination
    if (moving.current || nextIndex < 0 || nextIndex === index) {
      return
    }
    if (nextIndex < photos.length) {
      showPhoto(nextIndex, nextIndex > index ? 1 : -1)
    } else if (hasMore) {
      moving.current = true
      setLoading(true)
      try {
        const count = await loadMore(destination === 'last')
        const loadedIndex = destination === 'last' ? (count ?? 0) - 1 : nextIndex
        if (count !== null && loadedIndex > index && loadedIndex < count) {
          showPhoto(loadedIndex, 1)
        }
      } finally {
        moving.current = false
        setLoading(false)
      }
    }
  }

  function move(direction: number) {
    return goTo(index + direction)
  }

  return (
    <MediaModal
      title={t('title')}
      closeLabel={t('close')}
      onClose={onClose}
      keyboardShortcuts="ArrowLeft ArrowRight Home End"
      onKeyDown={(event) => {
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          void goTo(event.key === 'Home' ? 0 : 'last')
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          void move(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
    >
      <div
        ref={viewport}
        className="relative grid h-full w-full touch-pan-y place-items-center overflow-hidden"
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
        {displayedPhotos.map((image) => {
          const outgoing = image !== photo
          const animation = sliding && (outgoing ? styles.slideOut : styles.slideIn)
          const showError = !outgoing && error
          const captionText = showError ? t('loadError') : image.caption
          const captionBelow = outgoing ? slide?.captionBelow : captionFitsBelow

          return (
            <div
              key={image.id}
              aria-hidden={outgoing || undefined}
              className={`pointer-events-none absolute inset-0 grid place-items-center ${animation || ''} ${slide?.direction === -1 ? styles.backward : ''} ${slide && !sliding && !outgoing ? 'invisible' : ''}`}
              onAnimationEnd={
                outgoing
                  ? undefined
                  : () => {
                      setSlide(null)
                    }
              }
            >
              <div className="relative" style={photoFrameStyle(image)}>
                <RevealImage
                  src={image.src}
                  alt={image.alt}
                  sizes="100vw"
                  fill
                  loading="eager"
                  fetchPriority={outgoing ? 'auto' : 'high'}
                  fit="contain"
                  unoptimized
                  onLoad={
                    outgoing
                      ? undefined
                      : () => {
                          setLoadedSource(image.src)
                        }
                  }
                  onError={
                    outgoing
                      ? undefined
                      : () => {
                          setSlide(null)
                        }
                  }
                />
                {captionText && (
                  <div
                    ref={outgoing ? undefined : caption}
                    className={`${styles.caption} absolute inset-x-0 text-center ${captionBelow ? 'top-full' : 'bottom-0'}`}
                  >
                    <p
                      className={`${styles.overlayText} ${showError ? 'bg-status-error-surface text-status-error-ink' : 'bg-ink/80 text-cream'} inline-block max-h-[50dvh] overflow-y-auto ${outgoing ? '' : 'pointer-events-auto'}`}
                      role={showError ? 'alert' : undefined}
                    >
                      {captionText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div
          ref={imageFrame}
          className="pointer-events-none relative"
          style={photoFrameStyle(photo)}
        >
          <div
            ref={previous}
            className={`${styles.previous} pointer-events-auto absolute top-1/2 flex w-max -translate-y-1/2 ${previousFitsOutside ? 'right-full' : 'left-0'}`}
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
            className={`${styles.next} pointer-events-auto absolute top-1/2 flex w-max -translate-y-1/2 ${nextFitsOutside ? 'left-full' : 'right-0'}`}
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
  const loadingPage = useRef(false)
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

  async function loadMore(throughEnd = false) {
    if (loadingPage.current) {
      return null
    }
    loadingPage.current = true
    setBusy(true)
    setError(false)
    try {
      const additional: GalleryPage['items'] = []
      let latest: GalleryPage
      let count = page.items.length
      do {
        const response = await fetch(
          imageUrl(`/api/hikes/${hikeId}/photos`) +
            `?locale=${locale}&limit=${throughEnd ? '100' : '24'}&offset=${String(count)}`,
        )
        if (!response.ok) {
          throw new Error('Gallery request failed')
        }
        latest = (await response.json()) as GalleryPage
        additional.push(...latest.items)
        count += latest.items.length
      } while (throughEnd && latest.items.length > 0 && count < latest.total)

      setPage({ ...latest, items: [...page.items, ...additional] })
      return count
    } catch {
      setError(true)
      return null
    } finally {
      loadingPage.current = false
      setBusy(false)
    }
  }
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const hasPhotos = photos.length > 0
  const characterShortcutsEnabled = useCharacterShortcutsEnabled()
  const firstPhotoButton = useClickShortcut<HTMLButtonElement>('p', {
    enabled: hasPhotos && selectedIndex === null,
  })

  if (!hasPhotos) {
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
            ref={index === 0 ? firstPhotoButton : undefined}
            key={photo.id}
            type="button"
            className="card-interactive relative aspect-[4/3] cursor-pointer overflow-hidden rounded-sm bg-beige"
            aria-label={t('open', { number: index + 1, description: photo.alt })}
            aria-haspopup="dialog"
            aria-keyshortcuts={index === 0 && characterShortcutsEnabled ? 'P' : undefined}
            onClick={() => {
              trackHikeInteraction({ name: 'gallery_open', hikeId, hikeTitle, locale })
              setSelectedIndex(index)
            }}
          >
            <RevealImage
              src={photo.thumbnailSrc}
              alt={photo.alt}
              fill
              fit="cover"
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
      {error && (
        <p role="alert" className="text-status-error-ink">
          {t('loadError')}
        </p>
      )}
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
