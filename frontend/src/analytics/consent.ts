export const consentKey = 'knut-analytics-consent'
export const consentLifetime = 180 * 24 * 60 * 60 * 1000
const changeEvent = 'analytics-consent-change'

type Consent = { version: 1; choice: 'accepted' | 'rejected'; savedAt: number }

export function readConsent(): Consent | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(consentKey) || 'null')
    if (
      value &&
      typeof value === 'object' &&
      'version' in value &&
      value.version === 1 &&
      'choice' in value &&
      (value.choice === 'accepted' || value.choice === 'rejected') &&
      'savedAt' in value &&
      typeof value.savedAt === 'number' &&
      Number.isFinite(value.savedAt) &&
      value.savedAt <= Date.now() &&
      Date.now() - value.savedAt < consentLifetime
    ) {
      return value as Consent
    }
  } catch {
    // Unavailable storage must never enable analytics.
  }
  return null
}

export function consentSnapshot() {
  return readConsent()?.choice || 'unknown'
}

export function saveConsent(choice: Consent['choice']) {
  try {
    window.localStorage.setItem(
      consentKey,
      JSON.stringify({ version: 1, choice, savedAt: Date.now() }),
    )
    window.dispatchEvent(new Event(changeEvent))
    return true
  } catch {
    return false
  }
}

export function subscribeConsent(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener(changeEvent, notify)
  // Expire open tabs as well as saved choices on a later visit.
  const timer = window.setInterval(notify, 1000)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(changeEvent, notify)
    window.clearInterval(timer)
  }
}

export function serverConsentSnapshot() {
  // localStorage is unavailable during SSR. Keep this distinct from a checked,
  // missing choice so hydration never flashes a banner for returning visitors.
  return 'pending' as const
}
