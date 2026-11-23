import { publicConfig } from '@/config/public'

export function imageUrl(url: string) {
  return `${publicConfig.apiBaseUrl}${new URL(url, 'http://internal').pathname}`
}

export type CoverSources = {
  full: string
  desktop: string
  wide?: string | null
  mobile: string
  card: string
}

export function hikeCoverSources(hike: {
  cover_image_url: string | null
  cover_sources?: (Omit<CoverSources, 'desktop'> & { desktop?: string | null }) | null
}): CoverSources | null {
  if (hike.cover_sources) {
    const publicUrl = (url: string) => imageUrl(url) + new URL(url, 'http://internal').search
    return {
      full: publicUrl(hike.cover_sources.full),
      desktop: publicUrl(hike.cover_sources.desktop ?? hike.cover_sources.full),
      wide: hike.cover_sources.wide ? publicUrl(hike.cover_sources.wide) : null,
      mobile: publicUrl(hike.cover_sources.mobile),
      card: publicUrl(hike.cover_sources.card),
    }
  }

  if (!hike.cover_image_url) {
    return null
  }

  const full = imageUrl(hike.cover_image_url)
  return { full, desktop: full, mobile: `${full}?variant=mobile`, card: `${full}?variant=card` }
}
