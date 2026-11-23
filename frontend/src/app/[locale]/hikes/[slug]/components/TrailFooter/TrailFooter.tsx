import type { ReactNode } from 'react'

import styles from './TrailFooter.module.css'

export function TrailFooter({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.surface} relative bg-forest-soft py-12 tablet:py-16`}>{children}</div>
  )
}
