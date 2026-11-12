import { IconStar, IconStarFilled, IconStarHalfFilled } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

const tones = {
  default: 'text-forest',
  caution: 'text-orange-dark',
}

export function StarRating({
  value,
  tone = 'default',
}: {
  value: number
  tone?: keyof typeof tones
}) {
  const t = useTranslations('Site.starRating')
  const score = Math.round(Math.min(5, Math.max(0, value)) * 2) / 2

  return (
    <div>
      <span className="sr-only">{t('score', { value: score })}</span>
      <span className="flex items-center gap-2" aria-hidden="true">
        <span className={`flex gap-0.5 ${tones[tone]}`}>
          {[1, 2, 3, 4, 5].map((star) => {
            const Icon =
              score >= star ? IconStarFilled : score >= star - 0.5 ? IconStarHalfFilled : IconStar

            return <Icon key={star} className="size-5 shrink-0" />
          })}
        </span>
        <span className="font-statistic text-sm text-muted">
          {t('numericScore', { value: score })}
        </span>
      </span>
    </div>
  )
}
