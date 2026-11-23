import type { CoverSources } from '@/api/images'
import { responsiveMedia } from '@/config/breakpoints'

const avifSample =
  'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAIQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAKW1kYXQSAAoIGAAGiAhoNCAyEx2Hh4Wd3HHHAsAAAJA1jjx+k8A='

type PrefetchPriority = 'low' | 'high'

const requested = new Set<string>()
const pending: { source: string; priority: PrefetchPriority }[] = []
const active = new Map<string, HTMLImageElement>()
const parallelDownloads = 2
let supportsAvif: Promise<boolean> | undefined

function canDecodeAvif() {
  supportsAvif ??= new Promise((resolve) => {
    const image = new Image()
    image.addEventListener(
      'load',
      () => {
        resolve(true)
      },
      { once: true },
    )
    image.addEventListener(
      'error',
      () => {
        resolve(false)
      },
      { once: true },
    )
    image.src = avifSample
  })
  return supportsAvif
}

async function coverSource(covers: CoverSources) {
  if (window.matchMedia(responsiveMedia.fullHikeCover).matches) {
    return covers.wide && (await canDecodeAvif()) ? covers.wide : covers.full
  }
  return window.matchMedia(responsiveMedia.desktopHikeCover).matches
    ? covers.desktop
    : covers.mobile
}

function downloadNext() {
  while (pending.length > 0) {
    const { source, priority } = pending[0]
    const limit = priority === 'high' ? parallelDownloads + 1 : parallelDownloads
    if (active.size >= limit) {
      return
    }

    pending.shift()
    const image = new Image()
    const done = () => {
      active.delete(source)
      downloadNext()
    }
    image.fetchPriority = priority
    image.addEventListener('load', done, { once: true })
    image.addEventListener(
      'error',
      () => {
        requested.delete(source)
        done()
      },
      { once: true },
    )
    active.set(source, image)
    image.src = source
  }
}

export async function prefetchHikeCover(covers: CoverSources, priority: PrefetchPriority = 'low') {
  const source = await coverSource(covers)
  if (requested.has(source)) {
    if (priority !== 'high') {
      return
    }
    const image = active.get(source)
    if (image) {
      image.fetchPriority = priority
      return
    }
    const queued = pending.findIndex((item) => item.source === source)
    if (queued < 0) {
      return
    }
    pending.splice(queued, 1)
  }

  requested.add(source)
  const item = { source, priority }
  if (priority === 'high') {
    pending.unshift(item)
  } else {
    pending.push(item)
  }
  downloadNext()
}
