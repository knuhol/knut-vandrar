/** @jest-environment node */
import { ImageResponse } from 'next/og'

import { GET } from '@/app/brand/hikes/[locale]/[slug]/route'
import { getHike } from '@/api/hikes'

jest.mock('@/api/hikes', () => ({ getHike: jest.fn() }))
jest.mock('@/config/server', () => ({ serverConfig: { apiBaseUrl: 'http://backend:8000' } }))
jest.mock('next/og', () => ({
  ImageResponse: jest.fn().mockImplementation(() => new Response('image')),
}))

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

test('renders the standard crop using only the configured media host', async () => {
  jest.mocked(getHike).mockResolvedValue({
    cover_image_url: 'https://another-host.example/api/media/cover.webp',
  } as Awaited<ReturnType<typeof getHike>>)
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('image', {
      headers: { 'Content-Type': 'image/webp' },
    }),
  )
  await GET(request, params())
  expect(fetchMock).toHaveBeenCalledWith(
    'http://backend:8000/api/media/cover.webp',
    expect.any(Object),
  )
  const [element, options] = jest.mocked(ImageResponse).mock.calls[0]
  const props = element.props as { style: { backgroundSize: string } }
  expect(props.style.backgroundSize).toBe('cover')
  expect(options).toMatchObject({ width: 1200, height: 630 })
})

test('does not render an unsuccessful media response', async () => {
  jest
    .mocked(getHike)
    .mockResolvedValue({ cover_image_url: '/api/media/cover.webp' } as Awaited<
      ReturnType<typeof getHike>
    >)
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
  expect((await GET(request, params())).status).toBe(502)
  expect(ImageResponse).not.toHaveBeenCalled()
})
