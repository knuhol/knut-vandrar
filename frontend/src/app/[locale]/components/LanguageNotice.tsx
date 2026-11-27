'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef } from 'react'

import { Button } from '@/components/Button'
import { Heading } from '@/components/Heading'
import { languageNoticeParameter } from '@/i18n/languageNotice'

export function LanguageNotice() {
  const t = useTranslations('Site.missingHikeTranslation')
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      data-keyboard-focus-only=""
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto max-h-[85dvh] w-[calc(100%-var(--spacing)*8)] max-w-popover overflow-auto rounded-lg bg-paper p-5 text-ink shadow-lg backdrop:bg-ink/55 tablet:p-7"
      onClose={() => {
        const url = new URL(window.location.href)
        url.searchParams.delete(languageNoticeParameter)
        window.history.replaceState(null, '', url)
      }}
    >
      <Heading as="h2" className="text-xl" id={titleId} tone="brand">
        {t('title')}
      </Heading>
      <p id={descriptionId} className="mt-2">
        {t('description')}
      </p>
      <form method="dialog" className="mt-4">
        <Button type="submit" size="small">
          {t('close')}
        </Button>
      </form>
    </dialog>
  )
}
