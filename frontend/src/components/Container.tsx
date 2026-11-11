import type { ReactNode } from 'react'

import type { UIComponentProps } from './uiComponentProps'

export function Container({ children }: UIComponentProps<{ children: ReactNode }>) {
  return <div className="mx-auto w-full max-w-page px-5 tablet:px-7">{children}</div>
}
