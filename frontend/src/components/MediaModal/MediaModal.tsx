'use client'

import { useEffect, useRef, type KeyboardEventHandler, type ReactNode } from 'react'

import styles from './MediaModal.module.css'

import { MediaControl } from './MediaControl'

export function MediaModal({
  title,
  closeLabel,
  children,
  onClose,
  onKeyDown,
}: {
  title: string
  closeLabel: string
  children: ReactNode
  onClose: () => void
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) {
      return
    }

    const overflow = document.body.style.overflow
    const padding = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const currentPadding = Number.parseFloat(getComputedStyle(document.body).paddingRight)
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${String(currentPadding + scrollbar)}px`
    element.showModal()

    return () => {
      element.close()
      document.body.style.overflow = overflow
      document.body.style.paddingRight = padding
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      className={`fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-ink p-0 text-cream ${styles.dialog}`}
      onClose={(event) => {
        // Ignore a queued cleanup event if Strict Mode has reopened the dialog.
        if (!event.currentTarget.open) {
          onClose()
        }
      }}
      onKeyDown={onKeyDown}
    >
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2 p-2 tablet:p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-sm font-semibold">{title}</span>
          <MediaControl action="close" label={closeLabel} onClick={() => dialog.current?.close()} />
        </div>
        <div className="min-h-0 min-w-0">{children}</div>
      </div>
    </dialog>
  )
}
