'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { useReportWebVitals } from 'next/web-vitals'
import { IconCookie } from '@tabler/icons-react'

import { reportWebVital } from '@/analytics/webVitals'
import { Link } from '@/i18n/navigation'
import { PageKey, staticPages } from '@/content/staticPages'
import { Button } from '@/components/Button'
import {
  consentSnapshot,
  saveConsent,
  serverConsentSnapshot,
  subscribeConsent,
} from '@/analytics/consent'
import { initializeAnalytics, stopAnalytics, trackPageView } from '@/analytics/googleAnalytics'

function WebVitals() {
  useReportWebVitals(reportWebVital)
  return null
}

export function Analytics({ measurementId }: { measurementId: string | null }) {
  const t = useTranslations('Site.analytics')
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, serverConsentSnapshot)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const pathname = usePathname()
  const accepted = consent === 'accepted' && measurementId !== null

  useEffect(() => {
    if (accepted && measurementId) {
      initializeAnalytics(measurementId)
      trackPageView()
    } else if (stopAnalytics()) {
      window.location.reload()
    }
  }, [accepted, measurementId, pathname])

  function choose(choice: 'accepted' | 'rejected') {
    if (!saveConsent(choice)) {
      setStorageError(true)
      return
    }
    setStorageError(false)
    setSettingsOpen(false)
  }

  return (
    <>
      <div className="flex items-center justify-center">
        <Button
          size="extraSmall"
          variant="secondaryInverted"
          onClick={() => {
            setSettingsOpen(true)
          }}
          aria-expanded={settingsOpen || consent === 'unknown'}
          aria-controls="analytics-consent"
        >
          <IconCookie aria-hidden="true" className="size-4" />
          {t('settings')}
        </Button>
      </div>
      {(settingsOpen || consent === 'unknown') && (
        <section
          id="analytics-consent"
          aria-labelledby="analytics-consent-title"
          className="fixed inset-x-0 bottom-0 z-100 max-h-svh overflow-y-auto border-t border-beige bg-panel-glass p-4 backdrop-blur-panel text-left text-base text-ink shadow-lg tablet:p-6"
        >
          <div className="mx-auto flex max-w-page flex-col gap-4 tablet:flex-row tablet:items-center tablet:gap-8">
            <div className="min-w-0 flex-1">
              <h2 id="analytics-consent-title" className="font-display text-xl font-bold">
                {t('title')}
              </h2>
              <p className="mt-2 whitespace-pre-line">{t('description')}</p>
              <p className="mt-2">
                <Link href={staticPages[PageKey.PrivacyPolicy].href} className="link-dotted">
                  {t('privacyPolicy')}
                </Link>
              </p>
              {storageError && (
                <p role="alert" className="mt-2">
                  {t('storageError')}
                </p>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-3 tablet:flex tablet:w-auto tablet:shrink-0 tablet:flex-wrap">
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  choose('accepted')
                }}
              >
                {t('accept')}
              </Button>
              <Button
                size="small"
                variant="tertial"
                onClick={() => {
                  choose('rejected')
                }}
              >
                {t('reject')}
              </Button>
            </div>
          </div>
        </section>
      )}
      {accepted && (
        <Script
          id="google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
          strategy="afterInteractive"
        />
      )}
      {accepted && <WebVitals />}
    </>
  )
}
