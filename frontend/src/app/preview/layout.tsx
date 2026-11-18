import type { Metadata } from 'next'
import { Montserrat, Source_Sans_3 } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'

import '../globals.css'
import { messages } from '@/i18n/messages'

const heading = Montserrat({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-heading',
  weight: ['700'],
  display: 'swap',
})
const body = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable} font-sans text-ink`}>
        <NextIntlClientProvider locale="en" messages={messages.en}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
