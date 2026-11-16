import { isIndexable } from '@/seo/urls'
import { sitemapIndex, xmlResponse } from '@/seo/sitemaps'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isIndexable) {
    return new Response(null, { status: 404 })
  }
  return xmlResponse(await sitemapIndex())
}
