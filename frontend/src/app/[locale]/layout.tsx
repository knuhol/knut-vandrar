import type { Metadata } from 'next'
import { Montserrat, Source_Sans_3, Barlow_Condensed } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import '../globals.css'
import { routing } from '@/i18n/routing'

const heading = Montserrat({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-heading',
  weight: ['600', '700', '800'],
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
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Site' })
  return {
    title: { default: t('metadataTitle'), template: t('metadataTitleTemplate') },
    description: t('metadataDescription'),
    manifest: '/brand/site.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.ico' },
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
  if (!hasLocale(routing.locales, locale)) notFound()
  return (
    <html lang={locale}>
      <body
        className={`${heading.variable} ${body.variable} ${numbers.variable} bg-paper font-sans text-body-mobile leading-body text-ink tablet:text-body`}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
