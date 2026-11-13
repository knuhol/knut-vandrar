'use client'

import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react'

const icons = { close: IconX, previous: IconArrowLeft, next: IconArrowRight }

export function MediaControl({
  action,
  label,
  disabled = false,
  onClick,
}: {
  action: keyof typeof icons
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  const Icon = icons[action]

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-forest px-4 py-2 text-base font-bold text-cream hover:bg-forest-dark focus-visible:bg-forest-dark disabled:cursor-default disabled:opacity-40"
    >
      <Icon className="size-5" strokeWidth="var(--icon-stroke-emphasis)" aria-hidden="true" />
    </button>
  )
}
