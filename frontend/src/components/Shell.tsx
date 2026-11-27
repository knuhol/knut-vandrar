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
import { headerLogoVariant, softwareLinks } from '@/config/site'
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
    <footer className="forest-landscape links-on-dark text-cream tablet:bg-position-[center,right_76%] desktop:bg-position-[center,right_70%] wide:bg-position-[center,right_66%]">
      <Container>
        <div className="flex flex-col items-center gap-3 py-5 text-center">
          <div className="flex flex-col items-center gap-x-4 gap-y-1 tablet:flex-row">
            <Link data-link-kind="brand" href="/" locale={locale} className="w-44 tablet:w-56">
              <Logo size="compact" variant="monochromatic" locale={locale} />
            </Link>
            <p className="text-sm text-beige">{t('footer')}</p>
          </div>

          <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2 text-sm">
            <a className="link-dotted" href={softwareLinks.source}>
              {t('sourceCode')}
            </a>
            <a className="link-dotted" href={softwareLinks.license}>
              {t('softwareLicense')}
            </a>
            <Link
              href={staticPages[PageKey.PrivacyPolicy].href}
              locale={locale}
              className="link-dotted"
            >
              {t('privacyPolicy')}
            </Link>
            <KeyboardShortcuts />
          </div>

          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-beige">
            <span>{t('copyright', { year: new Date().getFullYear() })}</span>
            <p>{t('softwareLicenseNotice')}</p>
          </div>
        </div>
      </Container>
    </footer>
  )
}
