import {
  consentKey,
  consentLifetime,
  consentSnapshot,
  readConsent,
  saveConsent,
  subscribeConsent,
} from '@/analytics/consent'

beforeEach(() => {
  window.localStorage.clear()
})

test('only an explicit unexpired choice grants consent', () => {
  expect(consentSnapshot()).toBe('unknown')
  expect(saveConsent('accepted')).toBe(true)
  expect(consentSnapshot()).toBe('accepted')
  expect(saveConsent('rejected')).toBe(true)
  expect(consentSnapshot()).toBe('rejected')
})

test.each([
  'invalid JSON',
  'null',
  '{}',
  JSON.stringify({ version: 2, choice: 'accepted', savedAt: Date.now() }),
  JSON.stringify({ version: 1, choice: 'accepted', savedAt: Date.now() + consentLifetime }),
  JSON.stringify({ version: 1, choice: 'accepted', savedAt: Date.now() - consentLifetime }),
])('fails closed for malformed, future or expired consent: %s', (value) => {
  window.localStorage.setItem(consentKey, value)
  expect(readConsent()).toBeNull()
})

test('storage failure never grants consent', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(readConsent()).toBeNull()
  expect(saveConsent('accepted')).toBe(false)
})

test('notifies subscribers about decisions and cross-tab changes', () => {
  const notify = jest.fn()
  const unsubscribe = subscribeConsent(notify)
  saveConsent('accepted')
  expect(notify).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new StorageEvent('storage', { key: consentKey }))
  expect(notify).toHaveBeenCalledTimes(2)
  unsubscribe()
  saveConsent('rejected')
  expect(notify).toHaveBeenCalledTimes(2)
})
