'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'

import { initializeAnalytics, stopAnalytics, trackPageView } from '@/analytics/umami'

type AnalyticsConfig = { websiteId: string; scriptUrl: string }

export function Analytics({ config }: { config: AnalyticsConfig | null }) {
  const pathname = usePathname()

  useEffect(() => {
    if (!config) {
      return
    }
    initializeAnalytics(config.websiteId)
    return () => {
      stopAnalytics()
    }
  }, [config])

  useEffect(() => {
    if (config) {
      trackPageView()
    }
  }, [config, pathname])

  if (!config) {
    return null
  }

  return (
    <Script
      id="umami-analytics"
      src={config.scriptUrl}
      data-website-id={config.websiteId}
      data-auto-pageview="false"
      data-performance="true"
      data-before-send="umamiBeforeSend"
      data-exclude-search="true"
      data-exclude-hash="true"
      onReady={trackPageView}
      strategy="afterInteractive"
    />
  )
}
