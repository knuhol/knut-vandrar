'use client'

import {
  IconArrowLeft,
  IconArrowRight,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconArrowsMinimize,
} from '@tabler/icons-react'

const icons = {
  close: IconX,
  previous: IconArrowLeft,
  next: IconArrowRight,
  zoomIn: IconZoomIn,
  zoomOut: IconZoomOut,
  reset: IconArrowsMinimize,
}

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
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink/55 p-0 text-base font-bold text-cream hover:bg-ink/80 focus-visible:bg-ink/80 disabled:cursor-default disabled:opacity-40"
    >
      <Icon className="size-5" strokeWidth="var(--icon-stroke-emphasis)" aria-hidden="true" />
    </button>
  )
}
