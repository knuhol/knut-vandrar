import { isIndexable } from '@/seo/urls'
import { sitemapDocument, xmlResponse } from '@/seo/sitemaps'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  if (!isIndexable) {
    return new Response(null, { status: 404 })
  }
  const { filename } = await params
  const document = await sitemapDocument(filename)
  return document ? xmlResponse(document) : new Response(null, { status: 404 })
}
