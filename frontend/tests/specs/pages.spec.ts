/** @jest-environment node */
import type * as WhatwgFetch from '@whatwg-node/fetch'
import { NextRequest } from 'next/server'

import { GET as switchLanguage } from '@/app/api/language/route'
import { getHike } from '@/api/hikes'
import { getPage } from '@/api/pages'
import { resolveLanguageDestination } from '@/i18n/destinations'

jest.mock('server-only', () => ({}))
jest.mock('@/config/server', () => ({ serverConfig: { apiBaseUrl: 'https://api.example.test' } }))
jest.mock('@/api/hikes', () => ({ getHike: jest.fn() }))

jest.mock('@whatwg-node/fetch', () => ({
  ...jest.requireActual<typeof WhatwgFetch>('@whatwg-node/fetch'),
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}))

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
beforeEach(() => {
  fetchMock.mockReset()
  jest.mocked(getHike).mockReset()
  jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
})

test('looks up published content by page key and locale with no cache', async () => {
  fetchMock.mockResolvedValue(Response.json({ content: { type: 'about', title: 'About' } }))
  const page = await getPage('about', 'sv')
  expect(page?.content.title).toBe('About')
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe('https://api.example.test/api/pages/about?locale=sv')
  expect(options?.cache).toBe('no-store')
})

test('a missing locale switches to the target home without English fallback', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
  expect(await getPage('czech-translation-notes', 'sv')).toBeUndefined()
  expect(await resolveLanguageDestination('/translationNotes', 'cs', 'sv', {})).toBe('/')
  expect(await resolveLanguageDestination('/about', 'cs', 'sv', {})).toBe('/')
})

test('available page locales preserve their explicit route when switching language', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(Response.json({ content: { type: 'about' } })))
  expect(await resolveLanguageDestination('/about', 'en', 'cs', {})).toBe('/about')
  expect(await resolveLanguageDestination('/privacyPolicy', 'en', 'cs', {})).toBe('/privacyPolicy')
})

function hikeLanguageRequest(fallback?: string) {
  const url = new URL('https://example.test/api/language')
  url.search = new URLSearchParams({
    locale: 'en',
    target: 'cs',
    pathname: '/hikes/[slug]',
    params: JSON.stringify({ slug: 'forest-trail' }),
    ...(fallback ? { fallback } : {}),
  }).toString()
  return new NextRequest(url)
}

test.each([undefined, 'home'])(
  'switching a hike with a missing translation opens the localized home with a notice (fallback %s)',
  async (fallback) => {
    jest.mocked(getHike).mockResolvedValue({
      available_translations: [{ locale: 'en', slug: 'forest-trail' }],
    } as Awaited<ReturnType<typeof getHike>>)

    const response = await switchLanguage(hikeLanguageRequest(fallback))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/cs?languageNotice=missing-hike-translation')
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('cs')
  },
)

test('an available hike translation uses its localized slug without a notice', async () => {
  jest.mocked(getHike).mockResolvedValue({
    available_translations: [{ locale: 'cs', slug: 'lesni-stezka' }],
  } as Awaited<ReturnType<typeof getHike>>)

  const response = await switchLanguage(hikeLanguageRequest())
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('/cs/hiky/lesni-stezka')
})

test('an unknown source hike keeps the ordinary fallback behavior', async () => {
  expect((await switchLanguage(hikeLanguageRequest())).status).toBe(404)
  const response = await switchLanguage(hikeLanguageRequest('home'))
  expect(response.headers.get('location')).toBe('/cs')
})

test('API failures surface as errors instead of pretending content is missing', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
  await expect(getPage('about', 'en')).rejects.toThrow('Could not load page')
})
