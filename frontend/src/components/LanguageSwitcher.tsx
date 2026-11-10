'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { IconChevronDown as ChevronDown, IconWorld as Globe } from '@tabler/icons-react'

import { DropdownSurface } from './DropdownSurface'

import type { Locale } from '@/i18n/routing'

export function LanguageSwitcher({
  locale,
  links,
}: {
  locale: Locale
  links: { locale: Locale; href: string }[]
}) {
  const t = useTranslations('Site')
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="ml-auto flex cursor-pointer items-center gap-1.25 rounded-control border border-control-border bg-transparent p-2 text-status tablet:ml-0 tablet:gap-2.25 tablet:px-3 tablet:text-small"
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
        {links.map((item) => (
          <DropdownMenu.Item key={item.locale} asChild>
            <Link
              href={item.href}
              hrefLang={item.locale}
              scroll={false}
              aria-current={item.locale === locale ? 'true' : undefined}
              onClick={() => {
                document.cookie = `NEXT_LOCALE=${item.locale};path=/;max-age=31536000;SameSite=Lax`
              }}
            >
              {t(`languages.${item.locale}`)}
            </Link>
          </DropdownMenu.Item>
        ))}
      </DropdownSurface>
    </DropdownMenu.Root>
  )
}
