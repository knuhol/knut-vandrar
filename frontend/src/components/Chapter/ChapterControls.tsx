'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconFold, IconArrowsVertical } from '@tabler/icons-react'

import { setDisclosureExpanded } from '../Disclosure/disclosureState'

import { useCharacterShortcutsEnabled } from '@/navigation/shortcutPreferences'
import { useClickShortcut } from '@/navigation/usePageShortcut'

export function ChapterControls({ targetId }: { targetId: string }) {
  const characterShortcutsEnabled = useCharacterShortcutsEnabled()
  const t = useTranslations('Site')
  const [count, setCount] = useState(0)
  const [allExpanded, setAllExpanded] = useState(false)
  const toggleButton = useClickShortcut<HTMLButtonElement>('c', {
    enabled: count > 0,
    sectionId: targetId,
  })

  useEffect(() => {
    const container = document.getElementById(targetId)
    if (!container) {
      return
    }
    function update() {
      const chapters = [
        ...(container?.querySelectorAll<HTMLDetailsElement>('details[data-chapter]') ?? []),
      ]
      setCount(chapters.length)
      setAllExpanded(
        chapters.length > 0 &&
          chapters.every(
            (chapter) =>
              chapter.dataset.expanded === 'true' ||
              (chapter.dataset.expanded === undefined && chapter.open),
          ),
      )
    }
    const observer = new MutationObserver(update)
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'data-expanded'],
    })
    container.addEventListener('toggle', update, true)
    update()
    return () => {
      observer.disconnect()
      container.removeEventListener('toggle', update, true)
    }
  }, [targetId])

  if (count === 0) {
    return null
  }
  const Icon = allExpanded ? IconFold : IconArrowsVertical

  return (
    <button
      ref={toggleButton}
      type="button"
      aria-controls={targetId}
      aria-keyshortcuts={characterShortcutsEnabled ? 'C' : undefined}
      aria-expanded={allExpanded}
      className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-forest hover:text-ink focus-visible:text-ink"
      onClick={() => {
        document
          .getElementById(targetId)
          ?.querySelectorAll<HTMLDetailsElement>('details[data-chapter]')
          .forEach((chapter) => {
            setDisclosureExpanded(chapter, !allExpanded)
          })
      }}
    >
      <Icon className="size-4" aria-hidden="true" />
      {t(allExpanded ? 'collapseAllChapters' : 'expandAllChapters')}
    </button>
  )
}
