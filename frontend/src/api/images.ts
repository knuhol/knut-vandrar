import { publicConfig } from '@/config/public'

export function imageUrl(url: string) {
  return `${publicConfig.apiBaseUrl}${new URL(url, 'http://internal').pathname}`
}

export function coverImageUrl(url: string, variant: 'card' | 'mobile') {
  return `${imageUrl(url)}?variant=${variant}`
}
