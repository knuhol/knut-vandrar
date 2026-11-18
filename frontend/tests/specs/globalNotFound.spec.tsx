/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server'
import { cookies } from 'next/headers'

import GlobalNotFound, { generateMetadata } from '@/app/global-not-found'
import RootNotFound, { generateMetadata as rootMetadata } from '@/app/not-found'
import { messages } from '@/i18n/messages'

jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/components/Shell', () => ({
  Header: () => <header data-site-header />,
  Footer: () => <footer />,
}))
jest.mock('@/styles/fonts', () => ({
  heading: { variable: 'heading-font' },
  body: { variable: 'body-font' },
  numbers: { variable: 'numbers-font' },
}))

test('invalid top-level segments share the global branded fallback', () => {
  expect(RootNotFound).toBe(GlobalNotFound)
  expect(rootMetadata).toBe(generateMetadata)
})

function savedLocale(value: string | undefined) {
  jest.mocked(cookies).mockResolvedValue({
    get: () => (value ? { name: 'NEXT_LOCALE', value } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

test.each(['sv', 'en', 'cs'] as const)(
  'renders the shared custom 404 with a localized home link in %s',
  async (locale) => {
    savedLocale(locale)
    const html = renderToStaticMarkup(await GlobalNotFound())
    expect(html).toContain(`<html lang="${locale}">`)
    expect(html).toContain(messages[locale].Site.pageNotFound)
    expect(html).toContain(messages[locale].Site.pageNotFoundMessage)
    expect(html).toContain(`href="/${locale}"`)
    expect(html).toContain('404')
    expect(html).toContain('<header data-site-header')
    expect(html).toContain('<footer')
    expect(html).toContain('id="content"')
    expect(html).not.toContain('This page could not be found.')
    expect(await generateMetadata()).toMatchObject({ robots: { index: false, follow: false } })
  },
)

test.each([undefined, 'unsupported'])(
  'falls back to Swedish for an absent or invalid preference: %p',
  async (locale) => {
    savedLocale(locale)
    const html = renderToStaticMarkup(await GlobalNotFound())
    expect(html).toContain('<html lang="sv">')
  },
)
