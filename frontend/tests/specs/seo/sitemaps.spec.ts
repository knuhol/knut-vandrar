/** @jest-environment node */
import { sitemapDocument, sitemapIndex } from '@/seo/sitemaps'
import { getHikeDiscovery } from '@/api/hikes'
import { GET as sitemapResponse } from '@/app/sitemap.xml/route'
import { GET as chunkResponse } from '@/app/sitemaps/[filename]/route'

jest.mock('server-only', () => ({}))
jest.mock('@/config/server', () => ({
  serverConfig: { deploymentEnvironment: 'prod', siteOrigin: 'https://knut.vandrar.se' },
}))
jest.mock('@/api/hikes', () => ({ getHikeDiscovery: jest.fn() }))

const discover = jest.mocked(getHikeDiscovery)

describe('sitemap discovery', () => {
  test('splits a growing collection into bounded sitemap files', async () => {
    discover.mockResolvedValue({ items: [], total: 1001, offset: 0, limit: 1 })
    const index = await sitemapIndex()
    expect(index).toContain('/sitemaps/pages-0.xml')
    expect(index).toContain('/sitemaps/hikes-0.xml')
    expect(index).toContain('/sitemaps/hikes-1.xml')
    expect(index).not.toContain('/sitemaps/hikes-2.xml')
  })

  test('publishes all existing translated URLs without inventing dates or translations', async () => {
    discover.mockResolvedValue({
      items: [
        {
          id: 'hike-1',
          translations: [
            { locale: 'en', slug: 'my-hike' },
            { locale: 'cs', slug: 'muj-hike' },
          ],
        },
      ],
      total: 1,
      offset: 0,
      limit: 100,
    })
    const xml = await sitemapDocument('hikes-0.xml')
    expect(xml).toContain('https://knut.vandrar.se/en/hikes/my-hike')
    expect(xml).toContain('https://knut.vandrar.se/cs/hiky/muj-hike')
    expect(xml?.match(/<url>/g)).toHaveLength(2)
    expect(xml).not.toContain('hreflang="sv"')
    expect(xml).not.toContain('<lastmod>')
    expect(xml).not.toContain('/admin')
  })

  test('rejects unknown, invalid, and out-of-range sitemap files', async () => {
    discover.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 1 })
    for (const file of [
      'private-0.xml',
      'hikes--1.xml',
      'hikes-0.xml',
      'pages-1.xml',
      'pages-01.xml',
      'pages-9007199254740992.xml',
    ]) {
      expect(await sitemapDocument(file)).toBeUndefined()
    }
    expect(await sitemapDocument('pages-0.xml')).toContain('hreflang="x-default"')
  })

  test('serves production XML and returns 404 for nonexistent chunks', async () => {
    discover.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 1 })
    const index = await sitemapResponse()
    expect(index.status).toBe(200)
    expect(index.headers.get('content-type')).toContain('application/xml')
    expect(index.headers.get('cache-control')).toContain('s-maxage=300')
    expect(await index.text()).toContain('<sitemapindex')
    const missing = await chunkResponse(
      new Request('https://knut.vandrar.se/sitemaps/hikes-0.xml'),
      { params: Promise.resolve({ filename: 'hikes-0.xml' }) },
    )
    expect(missing.status).toBe(404)
  })
})
