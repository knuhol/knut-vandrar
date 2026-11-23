import { publicConfig } from '@/config/public'

export function imageUrl(url: string) {
  return `${publicConfig.apiBaseUrl}${new URL(url, 'http://internal').pathname}`
}

export type CoverSources = { full: string; mobile: string; card: string }

export function hikeCoverSources(hike: {
  cover_image_url: string | null
  cover_sources?: CoverSources | null
}): CoverSources | null {
  if (hike.cover_sources) {
    const publicUrl = (url: string) => imageUrl(url) + new URL(url, 'http://internal').search
    return {
      full: publicUrl(hike.cover_sources.full),
      mobile: publicUrl(hike.cover_sources.mobile),
      card: publicUrl(hike.cover_sources.card),
    }
  }

  if (!hike.cover_image_url) {
    return null
  }

  const full = imageUrl(hike.cover_image_url)
  return { full, mobile: `${full}?variant=mobile`, card: `${full}?variant=card` }
}
