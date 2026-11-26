'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconChevronDown as ChevronDown, IconWorld as Globe } from '@tabler/icons-react'

import { MenuItem } from './MenuItem/MenuItem'
import { DropdownSurface } from './DropdownSurface'
import type { UIComponentProps } from './uiComponentProps'

import { usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/routing'
import { useCharacterShortcutsEnabled } from '@/navigation/shortcutPreferences'
import { usePageShortcut } from '@/navigation/usePageShortcut'

export function LanguageSwitcher({ locale }: UIComponentProps<{ locale: Locale }>) {
  const t = useTranslations('Site')
  const pathname = usePathname()
  const params = useParams()
  const characterShortcutsEnabled = useCharacterShortcutsEnabled()
  const router = useRouter()
  const trigger = useRef<HTMLButtonElement>(null)

  function languageHref(target: Locale, fallbackToHome = false) {
    const query = new URLSearchParams({ locale, target, pathname, params: JSON.stringify(params) })
    if (fallbackToHome) {
      query.set('fallback', 'home')
    }
    return `/api/language?${query.toString()}`
  }

  usePageShortcut('l', () => {
    const nextLocale =
      routing.locales[(routing.locales.indexOf(locale) + 1) % routing.locales.length]
    router.push(languageHref(nextLocale, true), { scroll: false })
  })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        ref={trigger}
        data-keyboard-focus-only=""
        className="header-control ml-auto cursor-pointer desktop:ml-0"
        aria-label={t('language')}
        aria-keyshortcuts={characterShortcutsEnabled ? 'L' : undefined}
      >
        <Globe className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden tablet:inline">{t(`languages.${locale}`)}</span>
        <span className="tablet:hidden" aria-hidden="true">
          {locale.toUpperCase()}
        </span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownSurface
        data-keyboard-focus-only=""
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(event) => {
          // Radix restores focus with focus(), which can scroll the outgoing page.
          event.preventDefault()
          trigger.current?.focus({ preventScroll: true })
        }}
      >
        {routing.locales.map((language) => (
          <MenuItem key={language} active={language === locale} asChild>
            <Link
              href={languageHref(language)}
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
          </MenuItem>
        ))}
      </DropdownSurface>
    </DropdownMenu.Root>
  )
}
