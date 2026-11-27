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
    <div className="rounded-sm border border-forest-outline bg-forest-soft p-3 text-forest">
      <p className="mb-2 text-sm font-semibold">{t('trackingPassword')}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <code
          className="block min-w-0 truncate rounded-sm border border-forest-outline bg-paper px-3 py-2 text-base text-forest select-all"
          title={password}
          onDoubleClick={(event) => {
            event.preventDefault()
            const selection = window.getSelection()
            if (selection) {
              const range = document.createRange()
              range.selectNodeContents(event.currentTarget)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }}
        >
          {password}
        </code>
        <Button variant="secondary" size="small" onClick={() => void copyPassword()}>
          {status === 'copied' ? (
            <IconCheck className="size-5 text-status-success-surface" aria-hidden="true" />
          ) : (
            <IconCopy className="size-5" aria-hidden="true" />
          )}
          <span aria-live="polite">
            {t(status === 'copied' ? 'trackingPasswordCopied' : 'copyTrackingPassword')}
          </span>
        </Button>
      </div>
      {status === 'failed' && (
        <p role="status" className="mt-3 text-sm leading-relaxed text-status-error-ink">
          {t('trackingPasswordCopyFailed')}
        </p>
      )}
    </div>
  )
}
