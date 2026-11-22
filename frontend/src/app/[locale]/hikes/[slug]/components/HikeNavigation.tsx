'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { IconChevronDown } from '@tabler/icons-react'

import type { HikeSectionId } from './hikeSections'

import { MenuItem } from '@/components/MenuItem/MenuItem'
import { DropdownSurface } from '@/components/DropdownSurface'
import { useReadingNavigation } from '@/components/ReadingNavigation'
import { getAnchorScrollTarget, scrollToElement, subscribeAnchorScroll } from '@/navigation/motion'

export type HikeNavigationItem = { id: HikeSectionId; label: string }
type Chapter = { element: HTMLDetailsElement; title: string }

export function HikeNavigation({ label, items }: { label: string; items: HikeNavigationItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [expanded, setExpanded] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const { setActive, slot, siteMenuOpen, setSiteMenuOpen } = useReadingNavigation()

  useEffect(() => {
    let frame = 0
    function update() {
      const style = getComputedStyle(document.documentElement)
      const headerHeight = Number.parseFloat(style.getPropertyValue('--header-height')) || 0
      const padding = Number.parseFloat(style.scrollPaddingTop) || headerHeight
      setActive(
        Boolean(sentinel.current && sentinel.current.getBoundingClientRect().top <= headerHeight),
      )
      const target = getAnchorScrollTarget()
      let current = items[0]?.id
      for (const { id } of items) {
        const section = document.getElementById(id)
        if (
          target
            ? section?.contains(target)
            : section && section.getBoundingClientRect().top <= padding + 1
        ) {
          current = id
        }
      }
      if (
        !target &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1
      ) {
        current = items.at(-1)?.id ?? current
      }
      setActiveId(current)
      const discovered = [
        ...(document
          .getElementById('story')
          ?.querySelectorAll<HTMLDetailsElement>('details[data-chapter]') ?? []),
      ].map((element) => ({
        element,
        title: element.querySelector('summary')?.textContent.trim() ?? '',
      }))
      setChapters((previous) =>
        previous.length === discovered.length &&
        previous.every(
          (item, index) =>
            item.element === discovered[index].element && item.title === discovered[index].title,
        )
          ? previous
          : discovered,
      )
      const selected =
        discovered.find(
          ({ element }) =>
            element.open &&
            (target
              ? element.contains(target)
              : element.getBoundingClientRect().top <= padding + 1 &&
                element.getBoundingClientRect().bottom > padding),
        ) ?? null
      setChapter((previous) =>
        previous?.element === selected?.element && previous?.title === selected?.title
          ? previous
          : selected,
      )
    }
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const unsubscribe = subscribeAnchorScroll(schedule)
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('toggle', schedule, true)
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('toggle', schedule, true)
      setActive(false)
      setSiteMenuOpen(false)
    }
  }, [items, setActive, setSiteMenuOpen])

  const currentLabel = items.find(({ id }) => id === activeId)?.label ?? label
  const controls = (
    <nav
      aria-label={label}
      className="flex min-h-11 min-w-0 items-center justify-center gap-3 text-forest"
    >
      <DropdownMenu.Root
        open={expanded && !siteMenuOpen}
        onOpenChange={(open) => {
          setExpanded(open)
        }}
      >
        <DropdownMenu.Trigger
          ref={trigger}
          onPointerDown={(event) => {
            if (expanded && event.button === 0 && !event.ctrlKey) {
              // Closing on pointer-down must also suppress the browser's native focus scroll.
              event.preventDefault()
              setExpanded(false)
            }
          }}
          className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-left text-lg font-semibold"
          title={chapter ? `${currentLabel} / ${chapter.title}` : currentLabel}
        >
          {chapter && (
            <span className="hidden shrink-0 text-muted desktop:inline">{currentLabel} /</span>
          )}
          <span className="truncate">{chapter?.title ?? currentLabel}</span>
          <IconChevronDown className="size-4 shrink-0" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownSurface
          align="center"
          sideOffset={6}
          onCloseAutoFocus={(event) => {
            // Restoring focus to the sticky header must not scroll its layout position into view.
            event.preventDefault()
            trigger.current?.focus({ preventScroll: true })
          }}
        >
          {items.map(({ id, label: title }) => (
            <DropdownMenu.Group key={id}>
              <MenuItem asChild active={activeId === id}>
                <a
                  href={`#${id}`}
                  aria-current={activeId === id ? 'location' : undefined}
                  onClick={() => {
                    setActiveId(id)
                  }}
                >
                  {title}
                </a>
              </MenuItem>
              {id === 'story' &&
                chapters.map((item) => (
                  <MenuItem
                    key={item.element.id}
                    asChild
                    level={2}
                    active={chapter?.element === item.element}
                  >
                    <button
                      type="button"
                      aria-current={chapter?.element === item.element ? 'location' : undefined}
                      onClick={() => {
                        if (!item.element.open) {
                          item.element.querySelector('summary')?.click()
                        }
                        void scrollToElement(item.element, { anchor: true })
                      }}
                    >
                      {item.title}
                    </button>
                  </MenuItem>
                ))}
            </DropdownMenu.Group>
          ))}
        </DropdownSurface>
      </DropdownMenu.Root>
    </nav>
  )

  return (
    <>
      <div ref={sentinel} data-hike-navigation aria-hidden="true" />
      {slot && createPortal(controls, slot)}
    </>
  )
}
