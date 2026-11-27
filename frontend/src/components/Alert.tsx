import type { ReactNode } from 'react'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react'

const variants = {
  success: {
    Icon: IconCircleCheck,
    colors: 'border-status-success/30 border-s-status-success bg-status-success-surface',
  },
  info: {
    Icon: IconInfoCircle,
    colors: 'border-status-info/30 border-s-status-info bg-status-info-surface',
  },
  warning: {
    Icon: IconAlertTriangle,
    colors: 'border-status-warning/30 border-s-status-warning bg-status-warning-surface',
  },
  error: {
    Icon: IconAlertCircle,
    colors: 'border-status-error/30 border-s-status-error bg-status-error-surface',
  },
}

export function Alert({
  tone,
  title,
  children,
  announcement,
}: {
  tone: keyof typeof variants
  title: string
  children?: ReactNode
  announcement?: 'polite' | 'assertive'
}) {
  const { Icon, colors } = variants[tone]
  const role =
    announcement === 'assertive' ? 'alert' : announcement === 'polite' ? 'status' : undefined

  return (
    <div className={`grid gap-2 rounded-sm border border-s-4 p-4 text-ink tablet:p-5 ${colors}`}>
      <p className="flex items-start gap-2 text-lg font-semibold" role={role}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {title}
      </p>
      {children}
    </div>
  )
}
