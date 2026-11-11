import { locale as rootLocale } from 'next/root-params'

import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { messages } from './messages'
import { routing } from './routing'

export default getRequestConfig(async ({ locale: override }) => {
  const requested = override ?? (await rootLocale())
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return { locale, messages: messages[locale], timeZone: 'Europe/Stockholm' }
})
