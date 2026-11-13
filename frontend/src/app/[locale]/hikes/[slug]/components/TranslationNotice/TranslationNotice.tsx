'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

export function TranslationNotice() {
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
        className="group inline-flex cursor-pointer items-center gap-2 rounded-sm border border-beige bg-paper px-3 py-2 text-left text-sm text-forest shadow-sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <IconInfoCircle className="size-4 shrink-0" aria-hidden="true" />
        {t('translationNoticeLabel')}
        <IconChevronDown
          className="size-4 shrink-0 transition-transform duration-(--duration-fast) group-aria-expanded:rotate-180"
          aria-hidden="true"
        />
      </button>
      <div id={id} hidden={!open} className="absolute top-full left-0 z-10 w-96 max-w-full pt-2">
        <p className="rounded-sm border border-beige bg-paper p-4 text-sm leading-relaxed text-forest shadow-sm">
          {t('translationNoticeDescription')}
        </p>
      </div>
    </div>
  )
}
