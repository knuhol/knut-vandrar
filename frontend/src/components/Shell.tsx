import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'

import { Navigation } from './Navigation/Navigation'
import { SiteHeader } from './SiteHeader'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Container } from './Container'
import type { UIComponentProps } from './uiComponentProps'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { headerLogoVariant } from '@/config/site'

export async function Header({ locale }: UIComponentProps<{ locale: Locale }>) {
  const t = await getTranslations('Site')
  const logoVariant = headerLogoVariant((await headers()).get('host'))

  return (
    <>
      <a className="absolute -top-25 left-2.5 z-100 bg-paper p-2.5 focus:top-2.5" href="#content">
        {t('skip')}
      </a>
      <SiteHeader>
        <div className="mx-auto flex max-w-page items-center gap-2.5 px-4 py-3 tablet:gap-6.25 tablet:px-8 tablet:py-5.5 desktop:gap-11">
          <Link data-link-kind="brand" className="min-w-0 flex-1 tablet:flex-none" href="/">
            <Logo variant={logoVariant} />
          </Link>
          <Navigation locale={locale} />
          <LanguageSwitcher locale={locale} />
        </div>
      </SiteHeader>
    </>
  )
}

export async function Footer({ children }: { children?: ReactNode }) {
  const t = await getTranslations('Site')

  return (
    <footer className="bg-forest text-cream">
      <Container>
        <div className="flex flex-col items-center justify-between gap-4 py-7.5 text-center text-sm desktop:grid desktop:grid-cols-3">
          <Link
            data-link-kind="brand"
            href="/"
            className="mb-1.5 md:mb-0 desktop:justify-self-start"
          >
            <Logo size="compact" variant="monochromatic" />
          </Link>
          <div className="desktop:text-center">
            <p>{t('footer')}</p>
            <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          </div>
          <div className="desktop:justify-self-end">{children}</div>
        </div>
      </Container>
    </footer>
  )
}
