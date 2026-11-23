/** @jest-environment node */
import type * as WhatwgFetch from '@whatwg-node/fetch'
import { NextRequest } from 'next/server'

import { GET as switchLanguage } from '@/app/api/language/route'
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

test('keyboard language switching falls back to the target home if a hike has no translation', async () => {
  const url = new URL('https://example.test/api/language')
  url.search = new URLSearchParams({
    locale: 'en',
    target: 'cs',
    pathname: '/hikes/[slug]',
    params: JSON.stringify({ slug: 'forest-trail' }),
  }).toString()
  expect((await switchLanguage(new NextRequest(url))).status).toBe(404)
  url.searchParams.set('fallback', 'home')

  const response = await switchLanguage(new NextRequest(url))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('/cs')
  expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('cs')
})

test('API failures surface as errors instead of pretending content is missing', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
  await expect(getPage('about', 'en')).rejects.toThrow('Could not load page')
})
