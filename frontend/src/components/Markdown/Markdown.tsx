import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Chapter } from '../Chapter/Chapter'

import type { UIComponentProps } from '../uiComponentProps'

import styles from './Markdown.module.css'
import { collapsibleSections } from './collapsibleSections'

const variants = {
  rich: styles.prose,
  article: `${styles.prose} ${styles.article}`,
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[collapsibleSections, { chapterLevel: variant === 'article' ? 3 : 2 }]]}
        components={{
          details: ({ children: content }) => <Chapter>{content}</Chapter>,
          summary: ({ children: content }) => (
            <summary>
              {content}
              <span className={styles.chapterArrow} data-disclosure-arrow aria-hidden="true" />
            </summary>
          ),
          table: ({ children: content }) => (
            <div className={styles.tableScroll}>
              <table>{content}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
