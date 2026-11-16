import { identityData, profileData } from '@/seo/structuredData'
import { pageMetadata } from '@/seo/metadata'
import { siteIdentity } from '@/config/site'

jest.mock('@/seo/text', () => ({ plainText: jest.fn() }))
jest.mock('server-only', () => ({}))
jest.mock('@/config/server', () => ({
  serverConfig: { deploymentEnvironment: 'prod', siteOrigin: 'https://knut.vandrar.se' },
}))

test.each([
  ['sv', '/sv/om-mig'],
  ['en', '/en/about'],
  ['cs', '/cs/o-mne'],
] as const)('connects the %s profile to the shared author identity', (locale, path) => {
  const person = identityData(locale)['@graph'][1]
  const profile = profileData(locale, 'About', 'Biography')
  expect(profile['@type']).toBe('ProfilePage')
  expect(profile.mainEntity['@id']).toBe(person['@id'])
  expect(person.url).toBe(`https://knut.vandrar.se${path}`)
  expect(profile.mainEntity.sameAs).toEqual(Object.values(siteIdentity.profiles))
  expect(profile.mainEntity.description).toBe('Biography')
  expect(JSON.stringify(profile)).not.toContain(siteIdentity.authorBirthDate)
  const metadata = pageMetadata({
    locale,
    title: 'Hike',
    description: 'Story',
    path: '/',
    languages: {},
    imageAlt: 'Image',
    article: true,
  })
  expect(metadata.authors).toEqual([{ name: siteIdentity.author, url: person.url }])
  expect(metadata.openGraph).toMatchObject({ authors: [person.url] })
})
