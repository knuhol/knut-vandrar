import type { Metadata } from 'next'
import { Montserrat, Source_Sans_3, Barlow_Condensed } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import '../globals.css'
import { Footer, Header } from '@/components/Shell'
import { routing } from '@/i18n/routing'

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
const numbers = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-numbers',
  weight: ['500', '600'],
  display: 'swap',
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    return {}
  }

  const t = await getTranslations({ locale, namespace: 'Site' })

  return {
    title: { default: t('metadataTitle'), template: t('metadataTitleTemplate') },
    description: t('metadataDescription'),
    manifest: '/brand/site.webmanifest',
    icons: {
      icon: [
        { url: '/brand/favicon.ico' },
        { url: '/brand/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
        { url: '/brand/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      ],
      apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return (
    <html lang={locale}>
      <body
        className={`${heading.variable} ${body.variable} ${numbers.variable} flex min-h-svh flex-col bg-paper font-sans text-lg leading-relaxed text-ink`}
      >
        <NextIntlClientProvider>
          <Header locale={locale} />
          <main id="content" className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
