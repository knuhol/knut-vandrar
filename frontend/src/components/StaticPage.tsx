import { Container } from './Container'
import { PageHeader } from './PageHeader'
import { Markdown } from './Markdown/Markdown'

import type { StandardPageContent } from '@/api/pages'

export function StaticPage({ content }: { content: StandardPageContent }) {
  return (
    <article>
      <PageHeader
        entrance
        eyebrow={content.eyebrow}
        title={content.title}
        introduction={content.introduction}
      />
      <Container>
        <div className="py-10 tablet:py-14">
          <Markdown>{content.body_markdown}</Markdown>
        </div>
      </Container>
    </article>
  )
}
