import { publicConfig } from '@/config/public'

export async function checkApiHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${publicConfig.apiBaseUrl}/health`, {
      cache: 'no-store',
      signal,
    })
    if (!response.ok) return false
    const health: unknown = await response.json()
    return (
      typeof health === 'object' &&
      health !== null &&
      'status' in health &&
      health.status === 'healthy'
    )
  } catch {
    return false
  }
}
