'use client'

import { useEffect } from 'react'

import { useRouter } from '@/i18n/navigation'

export function HikeKeyboardNavigation({
  previousSlug,
  nextSlug,
}: {
  previousSlug?: string
  nextSlug?: string
}) {
  const router = useRouter()

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      const slug =
        event.key === 'ArrowLeft' ? previousSlug : event.key === 'ArrowRight' ? nextSlug : undefined
      if (
        !slug ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }

      if (
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            event.target.closest(
              'input, textarea, select, audio, video, [role="slider"], [role="tablist"]',
            ))) ||
        document.querySelector('dialog[open], [aria-modal="true"], [role="menu"], [role="listbox"]')
      ) {
        return
      }

      event.preventDefault()
      router.push({ pathname: '/hikes/[slug]', params: { slug } })
    }

    window.addEventListener('keydown', navigate)
    return () => {
      window.removeEventListener('keydown', navigate)
    }
  }, [nextSlug, previousSlug, router])

  return null
}
