import styles from './AboutTrailCallout.module.css'

import { ButtonLink } from '@/components/Button'
import { Heading } from '@/components/Heading'

export function AboutTrailCallout({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: string
}) {
  return (
    <section className="relative isolate mb-12 rounded-lg bg-forest p-6 text-cream tablet:mb-16 tablet:p-10">
      <div
        aria-hidden="true"
        className={`photo-collage pointer-events-none absolute inset-0 -z-1 overflow-hidden rounded-lg bg-forest bg-size-(--container-page) bg-blend-multiply brightness-110 contrast-115 ${styles.artwork}`}
      />
      <div className="flex flex-col items-start justify-between gap-6 desktop:flex-row desktop:items-center desktop:gap-12">
        <div className="max-w-reading">
          <Heading as="h2" tone="inverse">
            {title}
          </Heading>
          <p className="mt-4">{description}</p>
        </div>
        <div className="shrink-0">
          <ButtonLink href={{ pathname: '/', hash: 'hikes' }}>{action}</ButtonLink>
        </div>
      </div>
    </section>
  )
}
