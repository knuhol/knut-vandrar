'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { IconChevronDown as ChevronDown, IconWorld as Globe } from '@tabler/icons-react'

import { DropdownSurface } from './DropdownSurface'
import type { UIComponentProps } from './uiComponentProps'

import { usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/routing'

export function LanguageSwitcher({ locale }: UIComponentProps<{ locale: Locale }>) {
  const t = useTranslations('Site')
  const pathname = usePathname()
  const params = useParams()
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        ref={trigger}
        className="ml-auto flex cursor-pointer items-center gap-1.25 rounded-sm border border-beige bg-transparent p-2 text-sm hover:bg-beige active:bg-beige data-[state=open]:bg-beige focus:outline-none tablet:ml-0 tablet:gap-2.25 tablet:px-3"
        aria-label={t('language')}
      >
        <Globe className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden tablet:inline">{t(`languages.${locale}`)}</span>
        <span className="tablet:hidden" aria-hidden="true">
          {locale.toUpperCase()}
        </span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownSurface
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(event) => {
          // Radix restores focus with focus(), which can scroll the outgoing page.
          event.preventDefault()
          trigger.current?.focus({ preventScroll: true })
        }}
      >
        {routing.locales.map((language) => (
          <DropdownMenu.Item key={language} asChild>
            <Link
              href={`/api/language?${new URLSearchParams({
                locale,
                target: language,
                pathname,
                params: JSON.stringify(params),
              }).toString()}`}
              prefetch={false}
              scroll={false}
              hrefLang={language}
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
