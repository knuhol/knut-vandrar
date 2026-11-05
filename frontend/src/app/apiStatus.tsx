'use client'

import { useEffect, useState } from 'react'

import { checkApiHealth } from '@/lib/api'

type ApiStatus = 'checking' | 'connected' | 'unavailable'

export function ApiStatusIndicator() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()

    const updateStatus = async () => {
      const healthy = await checkApiHealth(controller.signal)
      setStatus(healthy ? 'connected' : 'unavailable')
    }

    void updateStatus()
    return () => {
      controller.abort()
    }
  }, [])

  return (
    <p role="status" aria-live="polite" className="mt-4 text-sm text-muted-foreground">
      API: {status}
    </p>
  )
}
