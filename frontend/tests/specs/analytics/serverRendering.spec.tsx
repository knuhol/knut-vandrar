/** @jest-environment node */
import { renderToString } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'

import { Analytics } from '@/app/[locale]/components/Analytics/Analytics'
import { messages } from '@/i18n/messages'

jest.mock('next/navigation', () => ({ usePathname: () => '/en' }))
jest.mock('next/web-vitals', () => ({ useReportWebVitals: jest.fn() }))

test('server HTML waits for browser consent storage without rendering the banner or Google script', () => {
  const html = renderToString(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <Analytics measurementId="G-TEST123" />
    </NextIntlClientProvider>,
  )
  expect(html).not.toContain('<section')
  expect(html).not.toContain('googletagmanager.com')
  expect(html).toContain('Cookie settings')
  expect(html).toContain('aria-expanded="false"')
})
