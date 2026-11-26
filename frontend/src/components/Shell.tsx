import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'

import { Navigation } from './Navigation/Navigation'
import { OngoingHikeLink } from './Navigation/OngoingHikeLink'
import { SiteHeader } from './SiteHeader/SiteHeader'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { KeyboardShortcuts } from './KeyboardShortcuts'
import { Container } from './Container'
import type { UIComponentProps } from './uiComponentProps'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { headerLogoVariant } from '@/config/site'
import { PageKey, staticPages } from '@/content/staticPages'

export async function Header({ locale }: UIComponentProps<{ locale: Locale }>) {
  const [t, requestHeaders] = await Promise.all([
    getTranslations({ locale, namespace: 'Site' }),
    headers(),
  ])
  const logoVariant = headerLogoVariant(requestHeaders.get('host'))

  return (
    <>
      <a className="absolute -top-25 left-2.5 z-100 bg-paper p-2.5 focus:top-2.5" href="#content">
        {t('skip')}
      </a>
      <SiteHeader
        brand={
          <Link data-link-kind="brand" href="/" locale={locale} className="block w-full">
            <Logo variant={logoVariant} size="header" locale={locale} />
          </Link>
        }
        brandIcon={
          <Link data-link-kind="brand" href="/" locale={locale} className="block w-full">
            <Logo variant={logoVariant} size="icon" locale={locale} />
          </Link>
        }
        navigation={<Navigation locale={locale} />}
        languages={<LanguageSwitcher locale={locale} />}
        hikeAction={<OngoingHikeLink locale={locale} />}
      />
    </>
  )
}

export async function Footer({ locale }: { locale?: Locale }) {
  const t = locale
    ? await getTranslations({ locale, namespace: 'Site' })
    : await getTranslations('Site')

  return (
    <footer className="links-on-dark bg-forest text-cream">
      <Container>
        <div className="flex flex-col items-center justify-between gap-4 py-7.5 text-center text-sm desktop:grid desktop:grid-cols-3">
          <Link
            data-link-kind="brand"
            href="/"
            locale={locale}
            className="mb-1.5 md:mb-0 desktop:justify-self-start"
          >
            <Logo size="compact" variant="monochromatic" locale={locale} />
          </Link>
          <div className="desktop:text-center">
            <p>{t('footer')}</p>
            <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 desktop:justify-end desktop:justify-self-end">
            <Link
              href={staticPages[PageKey.PrivacyPolicy].href}
              locale={locale}
              className="link-dotted"
            >
              {t('privacyPolicy')}
            </Link>
            <KeyboardShortcuts />
          </div>
        </div>
      </Container>
    </footer>
  )
}
