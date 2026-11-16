import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { TranslationNotice } from '@/app/[locale]/hikes/[slug]/components/TranslationNotice/TranslationNotice'
import { messages } from '@/i18n/messages'

test('Czech notice links to the Czech-only notes after opening', () => {
  render(
    <NextIntlClientProvider locale="cs" messages={messages.cs}>
      <TranslationNotice />
    </NextIntlClientProvider>,
  )
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('link', { name: messages.cs.Site.translationNotesLink })).toHaveAttribute(
    'href',
    '/cs/poznamky-k-prekladum',
  )
})

test.each(['sv', 'en'] as const)('%s has neither Czech-only content nor a notes link', (locale) => {
  render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <TranslationNotice />
    </NextIntlClientProvider>,
  )
  fireEvent.click(screen.getByRole('button'))
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
