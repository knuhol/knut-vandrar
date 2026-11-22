'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { IconZoomIn } from '@tabler/icons-react'

import styles from './MapViewer.module.css'

import { MediaModal } from '@/components/MediaModal/MediaModal'
import { MediaControl } from '@/components/MediaModal/MediaControl'
import { imageUrl } from '@/api/images'
import type { HikeMapImage } from '@/api/hikes'

const minimumZoom = 1
const maximumZoom = 4

function MapLightbox({
  image,
  hikeTitle,
  onClose,
}: {
  image: HikeMapImage
  hikeTitle: string
  onClose: () => void
}) {
  const t = useTranslations('Site.map')
  const [zoom, setZoom] = useState(minimumZoom)
  const viewport = useRef<HTMLDivElement>(null)
  const center = useRef({ x: 0.5, y: 0.5 })
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null)

  function changeZoom(next: number) {
    const element = viewport.current
    if (element) {
      center.current =
        next === minimumZoom
          ? { x: 0.5, y: 0.5 }
          : {
              x: (element.scrollLeft + element.clientWidth / 2) / (element.scrollWidth || 1),
              y: (element.scrollTop + element.clientHeight / 2) / (element.scrollHeight || 1),
            }
    }
    setZoom(Math.min(maximumZoom, Math.max(minimumZoom, next)))
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = viewport.current
      if (element) {
        element.scrollTo({
          left: center.current.x * element.scrollWidth - element.clientWidth / 2,
          top: center.current.y * element.scrollHeight - element.clientHeight / 2,
          behavior: 'instant',
        })
      }
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [zoom])

  return (
    <MediaModal
      title={t('viewerTitle', { title: hikeTitle })}
      closeLabel={t('close')}
      onClose={onClose}
      onKeyDown={(event) => {
        if (['+', '=', '-', '0'].includes(event.key)) {
          event.preventDefault()
          changeZoom(event.key === '0' ? minimumZoom : zoom + (event.key === '-' ? -0.5 : 0.5))
        }
        const element = viewport.current
        if (element) {
          const movements: Record<string, ScrollToOptions | undefined> = {
            ArrowLeft: { left: -element.clientWidth / 4 },
            ArrowRight: { left: element.clientWidth / 4 },
            ArrowUp: { top: -element.clientHeight / 4 },
            ArrowDown: { top: element.clientHeight / 4 },
          }
          const movement = movements[event.key]
          if (movement) {
            event.preventDefault()
            element.scrollBy({ ...movement, behavior: 'instant' })
          }
        }
      }}
    >
      <div className="flex h-full flex-col bg-cream text-forest">
        <div className={styles.tools} role="group" aria-label={t('zoomControls')}>
          <MediaControl
            action="zoomIn"
            label={t('zoomIn')}
            disabled={zoom === maximumZoom}
            onClick={() => {
              changeZoom(zoom + 0.5)
            }}
          />
          <MediaControl
            action="zoomOut"
            label={t('zoomOut')}
            disabled={zoom === minimumZoom}
            onClick={() => {
              changeZoom(zoom - 0.5)
            }}
          />
          <MediaControl
            action="reset"
            label={t('reset')}
            disabled={zoom === minimumZoom}
            onClick={() => {
              changeZoom(minimumZoom)
            }}
          />
          <span className="rounded-full bg-ink/80 px-3 py-1 text-sm text-cream" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <div
          ref={viewport}
          className={`${styles.viewport} min-h-0 flex-1 overflow-auto ${zoom > minimumZoom ? 'cursor-grab active:cursor-grabbing' : ''}`}
          role="region"
          aria-label={t('alt', { title: hikeTitle })}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse' || event.button !== 0 || zoom === minimumZoom) {
              return
            }
            event.preventDefault()
            dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const previous = dragging.current
            if (!previous || previous.id !== event.pointerId) {
              return
            }
            event.currentTarget.scrollBy({
              left: previous.x - event.clientX,
              top: previous.y - event.clientY,
              behavior: 'instant',
            })
            dragging.current = { ...previous, x: event.clientX, y: event.clientY }
          }}
          onPointerUp={(event) => {
            dragging.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onPointerCancel={() => {
            dragging.current = null
          }}
        >
          <div className="flex min-h-full min-w-full w-max">
            <Image
              src={imageUrl(image.url)}
              alt={t('alt', { title: hikeTitle })}
              width={image.width}
              height={image.height}
              unoptimized
              draggable={false}
              className="m-auto block h-auto shrink-0 select-none"
              style={{
                width: `min(${String(zoom * 100)}cqw, calc(${String(zoom * 100)}cqh * ${String(image.width / image.height)}))`,
                maxWidth: 'none',
              }}
            />
          </div>
        </div>
        <p className={styles.help}>{t('instructions')}</p>
      </div>
    </MediaModal>
  )
}

export function MapViewer({
  images,
  hikeTitle,
  children,
}: {
  images: HikeMapImage[]
  hikeTitle: string
  children: ReactNode
}) {
  const t = useTranslations('Site.map')
  const [open, setOpen] = useState(false)
  const image = images.reduce((best, candidate) =>
    candidate.width * candidate.height > best.width * best.height ? candidate : best,
  )

  return (
    <>
      <div className="relative">
        {children}
        <button
          type="button"
          aria-label={t('open')}
          onClick={() => {
            setOpen(true)
          }}
          className="group absolute inset-0 cursor-zoom-in text-cream focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange"
        >
          <span className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-full bg-ink/80 px-3 py-2 text-sm font-semibold group-hover:bg-forest group-focus-visible:bg-forest">
            <IconZoomIn className="size-4" aria-hidden="true" />
            {t('open')}
          </span>
        </button>
      </div>
      {open && (
        <MapLightbox
          image={image}
          hikeTitle={hikeTitle}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
