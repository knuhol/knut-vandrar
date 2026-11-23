'use client'

import { useEffect } from 'react'

import { useRouter } from '@/i18n/navigation'
import { allowsPageShortcut } from '@/navigation/keyboardShortcuts'

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
      if (!slug || !allowsPageShortcut(event)) {
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
