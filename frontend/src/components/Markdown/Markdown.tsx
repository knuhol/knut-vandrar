import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { UIComponentProps } from '../uiComponentProps'

import styles from './Markdown.module.css'
import { collapsibleSections } from './collapsibleSections'

const variants = {
  rich: styles.prose,
  lead: `${styles.prose} text-xl`,
  summary: 'line-clamp-3 text-base text-muted tablet:min-h-[3lh] [&_p]:m-0',
}

export function Markdown({
  children,
  variant = 'rich',
}: UIComponentProps<{
  children: string
  variant?: keyof typeof variants
}>) {
  return (
    <div className={variants[variant]}>
      {variant === 'summary' ? (
        <ReactMarkdown allowedElements={['p', 'em', 'strong']} unwrapDisallowed>
          {children}
        </ReactMarkdown>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[collapsibleSections]}>
          {children}
        </ReactMarkdown>
      )}
    </div>
  )
}
