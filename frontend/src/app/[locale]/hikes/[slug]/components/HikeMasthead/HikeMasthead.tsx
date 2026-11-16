import { HikeFacts } from '../HikeFacts'

import styles from './HikeMasthead.module.css'

import { Heading } from '@/components/Heading'
import type { Hike } from '@/api/hikes'
import type { HikeEndpoints } from '@/hiking/presentation'

export function HikeMasthead({ hike, endpoints }: { hike: Hike; endpoints: HikeEndpoints }) {
  return (
    <header
      className={`${styles.landscape} min-w-0 rounded-lg bg-forest wrap-anywhere p-5 tablet:p-8 desktop:p-10`}
    >
      <div className={`${styles.intro} mb-8`}>
        <div className="mb-4">
          <Heading tone="inverse">{hike.translation.title}</Heading>
        </div>
        {hike.translation.tagline && (
          <p className="text-xl leading-relaxed text-cream italic">{hike.translation.tagline}</p>
        )}
      </div>
      <div className={styles.facts}>
        <HikeFacts hike={hike} endpoints={endpoints} />
      </div>
    </header>
  )
}
