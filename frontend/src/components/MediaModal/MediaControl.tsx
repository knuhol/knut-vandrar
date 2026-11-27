'use client'

import {
  IconArrowLeft,
  IconArrowRight,
  IconCurrentLocation,
  IconRoute,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconArrowsMinimize,
  IconMaximize,
} from '@tabler/icons-react'

const icons = {
  close: IconX,
  previous: IconArrowLeft,
  next: IconArrowRight,
  zoomIn: IconZoomIn,
  zoomOut: IconZoomOut,
  reset: IconArrowsMinimize,
  expand: IconMaximize,
  center: IconCurrentLocation,
  overview: IconRoute,
}

export function MediaControl({
  action,
  label,
  disabled = false,
  size = 'default',
  pressed,
  onClick,
}: {
  action: keyof typeof icons
  label: string
  disabled?: boolean
  size?: 'default' | 'compact'
  pressed?: boolean
  onClick: () => void
}) {
  const Icon = icons[action]
  const compact = size === 'compact'

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink/55 p-0 text-base font-bold text-cream hover:bg-ink/80 focus-visible:bg-ink/80 disabled:cursor-default disabled:opacity-40 aria-pressed:bg-forest aria-pressed:ring-2 aria-pressed:ring-cream aria-pressed:hover:bg-forest-dark aria-pressed:focus-visible:bg-forest-dark ${compact ? 'size-10' : 'size-11'}`}
    >
      <Icon
        className={compact ? 'size-4.5' : 'size-5'}
        strokeWidth="var(--icon-stroke-emphasis)"
        aria-hidden="true"
      />
    </button>
  )
}
