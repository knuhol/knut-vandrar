// Reject styling overrides even when callers spread props from another element.
export type UIComponentProps<Props> = Omit<Props, 'className' | 'style'> & {
  className?: never
  style?: never
}
