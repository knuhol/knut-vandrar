import { absoluteUrl, isIndexable } from '@/seo/urls'
import { robotsText } from '@/seo/crawlers'

export const dynamic = 'force-dynamic'

export function GET() {
  return new Response(robotsText(isIndexable, absoluteUrl('/sitemap.xml')), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
