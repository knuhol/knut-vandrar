'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconFold, IconArrowsVertical } from '@tabler/icons-react'

import { setChapterExpanded } from './chapterState'

export function ChapterControls({ targetId }: { targetId: string }) {
  const t = useTranslations('Site')
  const [count, setCount] = useState(0)
  const [allExpanded, setAllExpanded] = useState(false)

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
      type="button"
      aria-controls={targetId}
      aria-expanded={allExpanded}
      className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-forest hover:underline focus-visible:underline"
      onClick={() => {
        document
          .getElementById(targetId)
          ?.querySelectorAll<HTMLDetailsElement>('details[data-chapter]')
          .forEach((chapter) => {
            setChapterExpanded(chapter, !allExpanded)
          })
      }}
    >
      <Icon className="size-4" aria-hidden="true" />
      {t(allExpanded ? 'collapseAllChapters' : 'expandAllChapters')}
    </button>
  )
}
