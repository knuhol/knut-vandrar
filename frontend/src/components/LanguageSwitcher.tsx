'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import { IconChevronDown as ChevronDown, IconWorld as Globe } from '@tabler/icons-react'

import { DropdownSurface } from './DropdownSurface'
import type { UIComponentProps } from './uiComponentProps'

import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/routing'

export function LanguageSwitcher({ locale }: UIComponentProps<{ locale: Locale }>) {
  const t = useTranslations('Site')

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="ml-auto flex cursor-pointer items-center gap-1.25 rounded-sm border border-beige bg-transparent p-2 text-sm hover:bg-beige active:bg-forest active:text-cream focus:outline-none tablet:ml-0 tablet:gap-2.25 tablet:px-3"
        aria-label={t('language')}
      >
        <Globe className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden tablet:inline">{t(`languages.${locale}`)}</span>
        <span className="tablet:hidden" aria-hidden="true">
          {locale.toUpperCase()}
        </span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownSurface align="end" sideOffset={8}>
        {routing.locales.map((language) => (
          <DropdownMenu.Item key={language} asChild>
            <Link
              href="/"
              locale={language}
              hrefLang={language}
              scroll={false}
              aria-current={language === locale ? 'true' : undefined}
              onClick={() => {
                document.cookie = `NEXT_LOCALE=${language};path=/;max-age=31536000;SameSite=Lax`
              }}
            >
              {t(`languages.${language}`)}
            </Link>
          </DropdownMenu.Item>
        ))}
      </DropdownSurface>
    </DropdownMenu.Root>
  )
}
