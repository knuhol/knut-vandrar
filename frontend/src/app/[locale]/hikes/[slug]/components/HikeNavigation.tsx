'use client'

import { useEffect, useState } from 'react'
import { IconArrowDown } from '@tabler/icons-react'

import { hikeSectionIcons, type HikeSectionId } from './hikeSections'

import { getAnchorScrollTarget, subscribeAnchorScroll } from '@/navigation/motion'

export type HikeNavigationItem = { id: HikeSectionId; label: string }

export function HikeNavigation({ label, items }: { label: string; items: HikeNavigationItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id)

  useEffect(() => {
    let frame = 0

    function update() {
      const target = getAnchorScrollTarget()
      if (target) {
        const destination = items.find(({ id }) => document.getElementById(id)?.contains(target))
        if (destination) {
          setActiveId(destination.id)
        }
        return
      }

      const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)
      let current = items[0]?.id
      for (const { id } of items) {
        const section = document.getElementById(id)
        if (section && section.getBoundingClientRect().top <= padding + 1) {
          current = id
        }
      }
      // The final section may be too short to reach the header's scroll offset.
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        current = items.at(-1)?.id ?? current
      }
      setActiveId(current)
    }
    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const unsubscribe = subscribeAnchorScroll(onScroll)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [items])

  return (
    <nav aria-label={label} className="rounded-lg bg-forest p-5 tablet:p-6">
      <p className="mb-4 text-xs font-bold tracking-widest text-orange uppercase">{label}</p>
      <ul className="grid gap-2 tablet:grid-cols-2 desktop:grid-cols-1">
        {items.map(({ id, label: title }) => {
          const Icon = hikeSectionIcons[id]
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={activeId === id ? 'location' : undefined}
                onClick={() => {
                  setActiveId(id)
                }}
                className={`flex min-h-12 items-start gap-3 rounded-sm px-3 py-3 text-sm font-semibold text-forest ${activeId === id ? 'bg-orange' : 'bg-cream'}`}
              >
                <Icon className="size-5 shrink-0 text-sage" aria-hidden="true" />
                <span className="min-w-0 flex-1">{title}</span>
                <IconArrowDown className="size-4 shrink-0" aria-hidden="true" />
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
