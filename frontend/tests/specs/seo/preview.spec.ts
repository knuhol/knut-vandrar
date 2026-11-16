/** @jest-environment node */
import { pageMetadata } from '@/seo/metadata'
import { GET as sitemapResponse } from '@/app/sitemap.xml/route'
import { GET as chunkResponse } from '@/app/sitemaps/[filename]/route'
import { GET as robotResponse } from '@/app/robots.txt/route'

jest.mock('server-only', () => ({}))
jest.mock('@/config/server', () => ({
  serverConfig: { deploymentEnvironment: 'dev', siteOrigin: 'https://dev.vandrar.se' },
}))
jest.mock('@/api/hikes', () => ({ getHikeDiscovery: jest.fn() }))

test('keeps preview pages out of search even when running a production build', () => {
  const metadata = pageMetadata({
    locale: 'en',
    title: 'Hiking',
    description: 'Stories',
    path: '/en',
    languages: {},
    imageAlt: 'Homepage',
  })
  expect(metadata.robots).toEqual({ index: false, follow: false })
})

test('does not expose sitemap discovery on previews', async () => {
  expect((await sitemapResponse()).status).toBe(404)
  expect(
    (
      await chunkResponse(new Request('https://dev.vandrar.se/sitemaps/pages-0.xml'), {
        params: Promise.resolve({ filename: 'pages-0.xml' }),
      })
    ).status,
  ).toBe(404)
  expect(await robotResponse().text()).toBe('User-agent: *\nDisallow: /\n')
})
