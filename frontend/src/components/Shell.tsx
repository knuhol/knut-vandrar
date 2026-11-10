import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { Navigation } from './Navigation'
import { SiteHeader } from './SiteHeader'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Container } from './Container'

import { routing, type Locale } from '@/i18n/routing'

export async function Header({
  locale,
  links,
}: {
  locale: Locale
  links?: { locale: Locale; href: string }[]
}) {
  const t = await getTranslations('Site')
  return (
    <>
      <a className="absolute -top-25 left-2.5 z-100 bg-paper p-2.5 focus:top-2.5" href="#content">
        {t('skip')}
      </a>
      <SiteHeader>
        <div className="mx-auto flex max-w-header items-center gap-2.5 px-4 py-3 tablet:gap-6.25 tablet:px-8 tablet:py-5.5 desktop:gap-11">
          <Link className="min-w-0 flex-1 tablet:flex-none" href={`/${locale}`}>
            <Logo className="block h-auto w-full max-w-47.5 tablet:w-(--brand-width) tablet:max-w-none" />
          </Link>
          <Navigation locale={locale} />
          <LanguageSwitcher
            locale={locale}
            links={
              links ??
              routing.locales.map((language) => ({ locale: language, href: `/${language}` }))
            }
          />
        </div>
      </SiteHeader>
    </>
  )
}

export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations('Site')
  return (
    <footer className="bg-footer text-cream">
      <Container className="flex flex-col items-center justify-between gap-2 py-7.5 text-center text-small tablet:flex-row tablet:gap-5 tablet:text-left">
        <Link href={`/${locale}`}>
          <Logo
            className="block h-auto w-(--brand-footer-width-mobile) max-w-full tablet:w-(--brand-footer-width)"
            variant="monochromatic"
          />
        </Link>
        <p>{t('footer')}</p>
        <span>{t('copyright', { year: new Date().getFullYear() })}</span>
      </Container>
    </footer>
  )
}
