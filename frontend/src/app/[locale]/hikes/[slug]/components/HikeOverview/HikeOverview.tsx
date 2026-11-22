import type { ReactNode } from 'react'

import styles from './HikeOverview.module.css'

export function HikeOverview({ map, children }: { map?: ReactNode; children: ReactNode }) {
  return (
    <div
      id="resources"
      className={`${styles.recess} relative grid items-start bg-cream ${map ? 'desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}
    >
      {map}
      <div className="grid min-w-0 gap-5 px-5 py-8 tablet:px-7 desktop:p-5 wide:p-6">
        {children}
      </div>
    </div>
  )
}
