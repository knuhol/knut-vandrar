import { publicConfig } from '@/config/public'

export function imageUrl(url: string) {
  return `${publicConfig.apiBaseUrl}${new URL(url).pathname}`
}
