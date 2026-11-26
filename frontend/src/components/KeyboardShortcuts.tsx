'use client'

import { useId, useRef } from 'react'
import { useTranslations } from 'next-intl'

import { Heading } from './Heading'
import { MediaControl } from './MediaModal/MediaControl'

import {
  setCharacterShortcutsEnabled,
  useCharacterShortcutsEnabled,
} from '@/navigation/shortcutPreferences'
import { useClickShortcut } from '@/navigation/usePageShortcut'

export function KeyboardShortcuts() {
  const t = useTranslations('Site')
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const openButton = useClickShortcut<HTMLButtonElement>('?')
  const enabled = useCharacterShortcutsEnabled()
  const groups = [
    {
      title: t('keyboardShortcuts.site'),
      entries: [
        ['?', t('keyboardShortcuts.title')],
        ['L', t('keyboardShortcuts.nextLanguage')],
      ],
    },
    {
      title: t('home'),
      entries: [
        ['A', t('aboutMe')],
        ['H', t('hikes')],
      ],
    },
    {
      title: t('keyboardShortcuts.hike'),
      entries: [
        ['←', t('previousHike')],
        ['→', t('nextHike')],
        ['P', t('keyboardShortcuts.photos')],
        ['M', t('map.open')],
        ['C', t('keyboardShortcuts.chapters')],
      ],
    },
    {
      title: t('gallery.title'),
      entries: [
        ['←', t('gallery.previous')],
        ['→', t('gallery.next')],
        ['Home', t('keyboardShortcuts.firstPhoto')],
        ['End', t('keyboardShortcuts.lastPhoto')],
        ['Esc', t('gallery.close')],
      ],
    },
    {
      title: t('keyboardShortcuts.map'),
      entries: [
        ['↑ ↓ ← →', t('keyboardShortcuts.panMap')],
        ['+', t('map.zoomIn')],
        ['−', t('map.zoomOut')],
        ['0', t('map.showWholeTrail')],
        ['Esc', t('map.close')],
      ],
    },
  ]

  return (
    <>
      <button
        ref={openButton}
        type="button"
        aria-haspopup="dialog"
        className="link-dotted cursor-pointer"
        onClick={() => {
          if (dialog.current && !dialog.current.open) {
            dialog.current.showModal()
          }
        }}
      >
        {t('keyboardShortcuts.title')}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-h-[85dvh] w-[calc(100%-var(--spacing)*8)] max-w-popover overflow-auto rounded-lg bg-paper p-5 text-left text-sm text-ink shadow-lg backdrop:bg-ink/55 tablet:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading as="h2" className="text-xl" id={titleId} tone="brand">
            {t('keyboardShortcuts.title')}
          </Heading>
          <MediaControl
            action="close"
            size="compact"
            label={t('keyboardShortcuts.close')}
            onClick={() => {
              dialog.current?.close()
            }}
          />
        </div>
        <label className="mt-4 flex items-start gap-3 border-b border-beige pb-4 font-semibold">
          <input
            type="checkbox"
            className="mt-[calc((1lh_-_var(--spacing)*4)/2)] size-4 shrink-0 accent-forest"
            checked={enabled}
            onChange={(event) => {
              setCharacterShortcutsEnabled(event.currentTarget.checked)
            }}
          />
          {t('keyboardShortcuts.enable')}
        </label>
        <div className="mt-4 grid gap-4">
          {groups.map(({ title, entries }) => (
            <section key={title}>
              <Heading as="h3" className="text-sm" tone="brand">
                {title}
              </Heading>
              <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
                {entries.map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt>{label}</dt>
                    <dd className="text-right">
                      <kbd className="rounded-sm border border-beige px-1.5 font-sans font-semibold text-forest">
                        {key}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </dialog>
    </>
  )
}
