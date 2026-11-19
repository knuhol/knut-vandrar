/** @jest-environment node */
import sharp from 'sharp'

import { GET } from '@/app/brand/hikes/[locale]/[slug]/route'
import { getHike } from '@/api/hikes'

jest.mock('@/api/hikes', () => ({ getHike: jest.fn() }))
jest.mock('@/config/server', () => ({ serverConfig: { apiBaseUrl: 'http://backend:8000' } }))

const request = new Request('https://knut.vandrar.se/brand/hikes/en/trail')
const params = (locale = 'en') => ({ params: Promise.resolve({ locale, slug: 'trail' }) })

test('rejects unsupported languages before loading a hike', async () => {
  expect((await GET(request, params('de'))).status).toBe(404)
  expect(getHike).not.toHaveBeenCalled()
})

test('returns 404 for a missing hike or cover', async () => {
  jest.mocked(getHike).mockResolvedValue(undefined)
  expect((await GET(request, params())).status).toBe(404)
  jest
    .mocked(getHike)
    .mockResolvedValue({ cover_image_url: null } as Awaited<ReturnType<typeof getHike>>)
  expect((await GET(request, params())).status).toBe(404)
})

test.each(['png', 'jpeg', 'webp'] as const)(
  'returns visible 1200 by 630 JPEG pixels from a %s photo using only the configured media host',
  async (format) => {
    jest.mocked(getHike).mockResolvedValue({
      cover_image_url: 'https://another-host.example/api/media/cover.webp',
    } as Awaited<ReturnType<typeof getHike>>)
    const source = await sharp({
      create: { width: 4, height: 3, channels: 3, background: { r: 37, g: 112, b: 61 } },
    })
      .toFormat(format)
      .toBuffer()
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(new Uint8Array(source), { headers: { 'Content-Type': `image/${format}` } }),
      )
    const response = await GET(request, params())
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:8000/api/media/cover.webp',
      expect.any(Object),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    const image = sharp(Buffer.from(await response.arrayBuffer()))
    expect(await image.metadata()).toMatchObject({ width: 1200, height: 630, format: 'jpeg' })
    const stats = await image.stats()
    expect(stats.isOpaque).toBe(true)
    expect(stats.channels[1].mean).toBeGreaterThan(100)
    expect(stats.channels[1].mean).toBeLessThan(125)
  },
)

test('does not render an unsuccessful media response', async () => {
  jest
    .mocked(getHike)
    .mockResolvedValue({ cover_image_url: '/api/media/cover.webp' } as Awaited<
      ReturnType<typeof getHike>
    >)
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
  expect((await GET(request, params())).status).toBe(502)
})

test('returns an error for corrupt media instead of a successful blank image', async () => {
  jest
    .mocked(getHike)
    .mockResolvedValue({ cover_image_url: '/api/media/cover.webp' } as Awaited<
      ReturnType<typeof getHike>
    >)
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('not an image', {
      headers: { 'Content-Type': 'image/webp' },
    }),
  )
  expect((await GET(request, params())).status).toBe(502)
})
