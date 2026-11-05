import { createClient, type NormalizeOAS } from 'fets'

import { publicConfig } from '@/config/public'
import type { openapi } from '@/generated/openapi'

export const apiClient = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: publicConfig.apiBaseUrl,
  globalParams: {
    cache: 'no-store',
  },
})

export async function checkApiHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await apiClient['/api/health'].get({
      signal,
    })

    if (!response.ok) return false
    const health = await response.json()
    return health.status === 'healthy'
  } catch {
    return false
  }
}
