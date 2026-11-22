'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ComponentProps } from 'react'

import type { UIComponentProps } from '../uiComponentProps'

import styles from './MenuItem.module.css'

export function MenuItem({
  active = false,
  level = 1,
  ...props
}: UIComponentProps<ComponentProps<typeof DropdownMenu.Item>> & {
  active?: boolean
  level?: 1 | 2
}) {
  return (
    <DropdownMenu.Item
      {...props}
      data-active={active || undefined}
      data-level={level}
      className={styles.item}
    />
  )
}
