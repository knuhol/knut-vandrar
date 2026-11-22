import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Analytics } from './components/Analytics/Analytics'
import { ReadingNavigationProvider } from '@/components/ReadingNavigation'
import { ImageMotion } from '@/components/ImageMotion'

import '../globals.css'
import { heading, body, numbers } from '@/styles/fonts'
import { PageMotion } from '@/components/PageMotion'
import { Footer, Header } from '@/components/Shell'
import { routing } from '@/i18n/routing'
import { StructuredData } from '@/components/StructuredData'
import { identityData } from '@/seo/structuredData'
import { isIndexable, siteOrigin } from '@/seo/urls'
import { serverConfig } from '@/config/server'
import { siteIdentity } from '@/config/site'

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
    metadataBase: new URL(siteOrigin),
    title: { default: t('metadataTitle'), template: t('metadataTitleTemplate') },
    description: t('metadataDescription'),
    applicationName: siteIdentity.name,
    authors: [{ name: siteIdentity.author }],
    creator: siteIdentity.author,
    publisher: siteIdentity.name,
    robots: isIndexable ? { index: true, follow: true } : { index: false, follow: false },
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
          <StructuredData data={identityData(locale)} />
          <PageMotion />
          <ImageMotion />
          <ReadingNavigationProvider>
            <Header locale={locale} />
            <main id="content" className="flex min-w-0 flex-1 flex-col">
              {children}
            </main>
            <Footer locale={locale} />
          </ReadingNavigationProvider>
          <Analytics config={serverConfig.analytics} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
