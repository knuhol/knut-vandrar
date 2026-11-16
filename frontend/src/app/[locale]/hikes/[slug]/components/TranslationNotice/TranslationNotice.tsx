'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { IconArrowUpRight, IconChevronDown, IconInfoCircle } from '@tabler/icons-react'
import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { PageKey, staticPages } from '@/content/staticPages'

export function TranslationNotice() {
  const locale = useLocale()
  const t = useTranslations('Site')
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)

    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div
      ref={ref}
      className="relative w-fit max-w-full"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          setOpen(true)
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') {
          setOpen(false)
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className="group inline-flex cursor-pointer items-center gap-2 rounded-sm border border-beige bg-paper px-3 py-2 text-left text-sm text-forest transition-colors duration-(--duration-fast) hover:border-forest-outline focus-visible:border-forest aria-expanded:border-forest-outline aria-expanded:bg-forest-soft"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <IconInfoCircle className="size-4 shrink-0 text-sage" aria-hidden="true" />
        {t('translationNoticeLabel')}
        <IconChevronDown
          className="size-4 shrink-0 transition-transform duration-(--duration-fast) group-aria-expanded:rotate-180"
          aria-hidden="true"
        />
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute top-full left-0 z-10 w-(--container-popover) max-w-[calc(100vw-var(--spacing)*8)] pt-3"
      >
        <div className="overflow-hidden rounded-lg border border-beige border-t-2 border-t-orange bg-paper shadow-lg">
          <div className="space-y-4 p-5 text-sm leading-relaxed tablet:p-6">
            {t.has('translationNoticeTitle') ? (
              <>
                <p className="font-semibold text-forest">{t('translationNoticeTitle')}</p>
                <p className="text-muted">{t('translationNoticeDescription')}</p>
              </>
            ) : (
              <p className="font-semibold text-forest">{t('translationNoticeDescription')}</p>
            )}
            {locale === 'cs' && <p className="text-muted">{t('translationTerminologyNote')}</p>}
          </div>
          {locale === 'cs' && (
            <div className="border-t border-beige bg-cream px-5 py-4 tablet:px-6">
              <Link
                href={staticPages[PageKey.CzechTranslationNotes].href}
                className="flex items-start justify-between gap-4 text-sm leading-relaxed font-semibold text-forest"
              >
                <span>{t('translationNotesLink')}</span>
                <IconArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
