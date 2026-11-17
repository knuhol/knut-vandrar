import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Analytics } from '@/app/[locale]/components/Analytics/Analytics'
import { stopAnalytics } from '@/analytics/googleAnalytics'
import { messages } from '@/i18n/messages'
import { consentKey, consentLifetime, saveConsent } from '@/analytics/consent'

jest.mock('next/navigation', () => ({ usePathname: () => '/en' }))
jest.mock('next/web-vitals', () => ({ useReportWebVitals: jest.fn() }))
jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ src }: { src: string }) => <span data-src={src} data-testid="ga-script" />,
}))

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  stopAnalytics()
})

function mount(measurementId: string | null = null, locale: keyof typeof messages = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Analytics measurementId={measurementId} />
    </NextIntlClientProvider>,
  )
}

test.each(['sv', 'en', 'cs'] as const)(
  'renders translated choices and persists rejection in %s',
  (locale) => {
    mount(null, locale)
    const text = messages[locale].Site.analytics
    expect(screen.getByRole('heading', { name: text.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: text.privacyPolicy })).toHaveAttribute(
      'href',
      { sv: '/sv/integritetspolicy', en: '/en/privacy-policy', cs: '/cs/ochrana-soukromi' }[locale],
    )
    expect(screen.queryByText('Close')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ga-script')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: text.reject }))
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: text.settings }))
    expect(screen.getByRole('heading', { name: text.title })).toBeInTheDocument()
  },
)

test('local review remains script-free even after accepting', () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Accept cookies' }))
  expect(screen.queryByTestId('ga-script')).not.toBeInTheDocument()
})

test('loads the Google script only after acceptance', () => {
  const view = mount('G-TEST123')
  expect(screen.queryByTestId('ga-script')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Accept cookies' }))
  expect(screen.getByTestId('ga-script')).toHaveAttribute(
    'data-src',
    'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
  )
  view.unmount()
})

test('reopens the banner when an open tab choice expires', () => {
  jest.useFakeTimers()
  saveConsent('rejected')
  mount()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  window.localStorage.setItem(
    consentKey,
    JSON.stringify({ version: 1, choice: 'rejected', savedAt: Date.now() - consentLifetime }),
  )
  act(() => {
    jest.advanceTimersByTime(1000)
  })
  expect(screen.getByRole('heading')).toBeInTheDocument()
  jest.useRealTimers()
})

test.each(['accepted', 'rejected'] as const)(
  'keeps the banner hidden for a saved %s choice and allows reopening settings',
  (choice) => {
    saveConsent(choice)
    mount()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    expect(
      screen.getByRole('heading', { name: messages.en.Site.analytics.title }),
    ).toBeInTheDocument()
  },
)
