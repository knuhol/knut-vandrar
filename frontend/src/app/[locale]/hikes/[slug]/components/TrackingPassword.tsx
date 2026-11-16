'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconCopy, IconCheck } from '@tabler/icons-react'

import { Button } from '@/components/Button'

export function TrackingPassword({ password }: { password: string }) {
  const t = useTranslations('Site')
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="mb-6 rounded-sm bg-cream/10 p-4 text-cream">
      <p className="mb-2 text-sm">{t('trackingPassword')}</p>
      <div className="flex flex-col items-start gap-3 tablet:flex-row tablet:items-center">
        <code className="min-w-0 w-full text-base break-all whitespace-pre-wrap select-all tablet:w-auto tablet:flex-1">
          {password}
        </code>
        <Button variant="secondary" size="small" onClick={() => void copyPassword()}>
          {status === 'copied' ? (
            <IconCheck className="size-5" aria-hidden="true" />
          ) : (
            <IconCopy className="size-5" aria-hidden="true" />
          )}
          <span aria-live="polite">
            {t(status === 'copied' ? 'trackingPasswordCopied' : 'copyTrackingPassword')}
          </span>
        </Button>
      </div>
      {status === 'failed' && (
        <p role="status" className="mt-3 text-sm">
          {t('trackingPasswordCopyFailed')}
        </p>
      )}
    </div>
  )
}
