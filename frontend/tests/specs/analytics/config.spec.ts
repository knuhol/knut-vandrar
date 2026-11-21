/** @jest-environment node */

jest.mock('server-only', () => ({}))
jest.mock('@/config/public', () => ({ publicConfig: { apiBaseUrl: 'http://localhost:8000' } }))

const websiteId = 'b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d'
const scriptUrl = 'https://umami.vandrar.se/script.js'

beforeEach(() => {
  jest.resetModules()
  jest.replaceProperty(process, 'env', {
    ...process.env,
    DEPLOYMENT_ENVIRONMENT: 'prod',
    SITE_URL: 'https://knut.vandrar.se',
    UMAMI_WEBSITE_ID: websiteId,
    UMAMI_SCRIPT_URL: scriptUrl,
  })
})

test('passes public runtime tracker configuration only in production', async () => {
  const { serverConfig } = await import(
    /* webpackChunkName: 'analytics-server-config' */ '@/config/server'
  )
  expect(serverConfig.analytics).toEqual({ websiteId, scriptUrl })
})

test.each(['local', 'dev'])('disables analytics in %s', async (environment) => {
  process.env.DEPLOYMENT_ENVIRONMENT = environment
  const { serverConfig } = await import(
    /* webpackChunkName: 'analytics-server-config' */ '@/config/server'
  )
  expect(serverConfig.analytics).toBeNull()
})

test('an empty website ID disables collection with the template script URL', async () => {
  process.env.UMAMI_WEBSITE_ID = ''
  const { serverConfig } = await import(
    /* webpackChunkName: 'analytics-server-config' */ '@/config/server'
  )
  expect(serverConfig.analytics).toBeNull()
})

test.each([
  ['invalid website ID', 'UMAMI_WEBSITE_ID', 'invalid'],
  ['insecure script URL', 'UMAMI_SCRIPT_URL', 'http://umami.vandrar.se/script.js'],
  [
    'credentials in script URL',
    'UMAMI_SCRIPT_URL',
    'https://user:secret@umami.vandrar.se/script.js',
  ],
  ['query in script URL', 'UMAMI_SCRIPT_URL', 'https://umami.vandrar.se/script.js?token=private'],
  ['fragment in script URL', 'UMAMI_SCRIPT_URL', 'https://umami.vandrar.se/script.js#fragment'],
])('rejects tracker configuration with %s', async (_case, key, value) => {
  process.env[key] = value
  await expect(
    import(/* webpackChunkName: 'analytics-server-config' */ '@/config/server'),
  ).rejects.toThrow('UMAMI_')
})

export {}
