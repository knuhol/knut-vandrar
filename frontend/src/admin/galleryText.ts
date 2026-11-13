import type { getPhotos } from '@/api/hikes'
import type { Locale } from '@/i18n/routing'

export type GalleryPhoto = Awaited<ReturnType<typeof getPhotos>>['items'][number]
export type GalleryText = { alt: string; caption: string }

export function photoText(photo: GalleryPhoto | undefined, locale: Locale): GalleryText {
  // Public reads fall back to English. Do not save that fallback as a translation.
  return photo?.translation.locale === locale
    ? { alt: photo.alt, caption: photo.caption || '' }
    : { alt: '', caption: '' }
}

export function photoTextChanged(draft: GalleryText, baseline: GalleryText) {
  return draft.alt !== baseline.alt || draft.caption !== baseline.caption
}
