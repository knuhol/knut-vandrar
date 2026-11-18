import { pageMetadata } from '@/seo/metadata'
import { homePath, homeLanguages, hikeLanguages } from '@/seo/urls'
import { staticPageMetadata } from '@/content/pages'
import { robotsText } from '@/seo/crawlers'
import { collectionOffset } from '@/hiking/pagination'

jest.mock('server-only', () => ({}))
jest.mock('@/api/pages', () => ({ getPage: jest.fn() }))
jest.mock('@/config/server', () => ({
  serverConfig: { deploymentEnvironment: 'prod', siteOrigin: 'https://knut.vandrar.se' },
}))

describe('public URL and crawler metadata', () => {
  test('keeps home URLs free of empty queries and preserves distinct pagination', () => {
    expect(homePath('en')).toBe('/en')
    expect(homePath('sv', 6)).toBe('/sv?offset=6')
    expect(homeLanguages()).toEqual({
      sv: 'https://knut.vandrar.se/sv',
      en: 'https://knut.vandrar.se/en',
      cs: 'https://knut.vandrar.se/cs',
    })
  })

  test('uses real localized slugs and omits unavailable languages', () => {
    expect(
      hikeLanguages([
        { locale: 'en', slug: 'first-hike' },
        { locale: 'cs', slug: 'prvni-hike' },
        { locale: 'de', slug: 'erste-wanderung' },
      ]),
    ).toEqual({
      en: 'https://knut.vandrar.se/en/hikes/first-hike',
      cs: 'https://knut.vandrar.se/cs/hiky/prvni-hike',
    })
  })

  test('shares the canonical identity across search and social metadata', () => {
    const metadata = pageMetadata({
      locale: 'cs',
      title: 'Dálkový hiking',
      description: 'Popis',
      path: '/cs',
      languages: homeLanguages(),
      imageAlt: 'Náhled',
    })
    expect(metadata.title).toEqual({ absolute: 'Dálkový hiking · Knut vandrar' })
    expect(metadata.alternates?.canonical).toBe('https://knut.vandrar.se/cs')
    expect(metadata.openGraph).toMatchObject({
      url: 'https://knut.vandrar.se/cs',
      locale: 'cs_CZ',
      siteName: 'Knut vandrar',
      images: [
        {
          url: 'https://knut.vandrar.se/brand/sharing/cs.png',
          width: 1200,
          height: 630,
          alt: 'Náhled',
        },
      ],
    })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })

  test('allows search separately from training and leaves public images crawlable', () => {
    const text = robotsText(true, 'https://knut.vandrar.se/sitemap.xml')
    const [search, training] = text.split('\n\n')
    expect(search).toContain('User-agent: OAI-SearchBot')
    expect(search).toContain('User-agent: Claude-SearchBot')
    expect(search).toContain('Allow: /')
    expect(search).not.toContain('Disallow: /api\n')
    expect(training).toContain('User-agent: GPTBot')
    expect(training).toContain('User-agent: Google-Extended')
    expect(training).toContain('Disallow: /')
    expect(robotsText(false, 'https://dev.vandrar.se/sitemap.xml')).toBe(
      'User-agent: *\nDisallow: /\n',
    )
  })

  test('bounds social descriptions without shortening the search description', () => {
    const description = 'A quiet journey through forests and lakes. '.repeat(4)
    const metadata = pageMetadata({
      locale: 'en',
      title: 'Hiking',
      description,
      path: '/en',
      languages: {},
      image: 'https://knut.vandrar.se/brand/hikes/en/hiking',
      imageSize: { width: 1200, height: 630 },
      imageAlt: 'Forest',
    })
    expect(metadata.description).toBe(description)
    const social = metadata.openGraph as { description: string; images: unknown[] }
    expect(social.description.length).toBeLessThanOrEqual(125)
    expect(social.description.endsWith('…')).toBe(true)
    expect(metadata.twitter).toMatchObject({ description: social.description })
    expect(social.images).toEqual([
      {
        url: 'https://knut.vandrar.se/brand/hikes/en/hiking',
        width: 1200,
        height: 630,
        alt: 'Forest',
      },
    ])
  })

  test.each([
    [undefined, 0],
    ['0', 0],
    ['6', 6],
    ['7', 6],
    ['12', 12],
    ['-1', 0],
    ['NaN', 0],
    ['1e2', 0],
    [['6', '12'], 0],
    ['9007199254740992', 0],
  ] as const)('normalizes collection offset %p', (value, expected) => {
    expect(collectionOffset(value as string | string[] | undefined)).toBe(expected)
  })
})

test('privacy policy uses localized canonical URLs and noindex metadata', () => {
  const metadata = staticPageMetadata({
    page_key: 'privacy-policy',
    locale: 'en',
    indexable: false,
    available_locales: ['sv', 'en', 'cs'],
    content: {
      type: 'standard',
      eyebrow: 'Privacy',
      title: 'Privacy policy',
      introduction: 'Cookies and privacy',
      body_markdown: 'Content',
    },
  })
  expect(metadata.robots).toMatchObject({ index: false })
  expect(metadata.alternates?.canonical).toBe('https://knut.vandrar.se/en/privacy-policy')
  expect(metadata.alternates?.languages).toMatchObject({
    sv: 'https://knut.vandrar.se/sv/integritetspolicy',
    cs: 'https://knut.vandrar.se/cs/ochrana-soukromi',
  })
})
