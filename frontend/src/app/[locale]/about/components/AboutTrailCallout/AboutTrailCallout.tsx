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
    <section className="forest-landscape mb-12 rounded-lg p-6 text-cream tablet:mb-16 tablet:p-10">
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
