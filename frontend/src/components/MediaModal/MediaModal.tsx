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
  keyboardShortcuts,
}: {
  title: string
  closeLabel: string
  children: ReactNode
  onClose: () => void
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>
  keyboardShortcuts?: string
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
    const currentPadding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0
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
      aria-keyshortcuts={keyboardShortcuts}
      className={`fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-ink p-0 text-cream ${styles.dialog}`}
      onClose={(event) => {
        // Ignore a queued cleanup event if Strict Mode has reopened the dialog.
        if (!event.currentTarget.open) {
          onClose()
        }
      }}
      onKeyDown={onKeyDown}
    >
      <div className="relative h-full w-full">
        <div className={`${styles.closeControl} absolute z-20`}>
          <MediaControl action="close" label={closeLabel} onClick={() => dialog.current?.close()} />
        </div>
        {children}
      </div>
    </dialog>
  )
}
