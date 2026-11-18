import type { Metadata } from 'next'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { hasLocale, NextIntlClientProvider } from 'next-intl'

import './globals.css'
import { ButtonLink } from '@/components/Button'
import { MessagePage } from '@/components/MessagePage/MessagePage'
import { Header, Footer } from '@/components/Shell'
import { messages } from '@/i18n/messages'
import { routing } from '@/i18n/routing'
import { siteIdentity } from '@/config/site'
import { heading, body, numbers } from '@/styles/fonts'

const errorLocale = cache(async () => {
  const saved = (await cookies()).get('NEXT_LOCALE')?.value
  return hasLocale(routing.locales, saved) ? saved : routing.defaultLocale
})

export async function generateMetadata(): Promise<Metadata> {
  const locale = await errorLocale()
  return {
    title: `${messages[locale].Site.pageNotFound} · ${siteIdentity.name}`,
    robots: { index: false, follow: false },
  }
}

export default async function GlobalNotFound() {
  const locale = await errorLocale()
  const t = messages[locale].Site

  return (
    <html lang={locale}>
      <body
        className={`${heading.variable} ${body.variable} ${numbers.variable} flex min-h-svh flex-col bg-paper font-sans text-lg leading-relaxed text-ink`}
      >
        <NextIntlClientProvider
          locale={locale}
          messages={messages[locale]}
          formats={{}}
          now={new Date()}
          timeZone={siteIdentity.timeZone}
        >
          <Header locale={locale} />
          <main id="content" className="content-enter flex flex-1 flex-col">
            <MessagePage code="404" title={t.pageNotFound} description={t.pageNotFoundMessage}>
              <ButtonLink variant="primary" href="/">
                {t.home}
              </ButtonLink>
            </MessagePage>
          </main>
          <Footer locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
