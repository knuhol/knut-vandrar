import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import styles from './Markdown.module.css'

export function Markdown({
  children,
  className = '',
  variant = 'rich',
}: {
  children: string
  className?: string
  variant?: 'rich' | 'summary'
}) {
  return (
    <div className={`${variant === 'rich' ? styles.prose : ''} ${className}`}>
      {variant === 'summary' ? (
        <ReactMarkdown allowedElements={['p', 'em', 'strong']} unwrapDisallowed>
          {children}
        </ReactMarkdown>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
      )}
    </div>
  )
}
