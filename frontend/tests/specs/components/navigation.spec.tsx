import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'

import { Navigation } from '@/components/Navigation/Navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { messages } from '@/i18n/messages'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useParams: () => ({ slug: 'forest-trail' }),
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/hikes/[slug]',
  Link: ({
    href,
    children,
    ...props
  }: Omit<ComponentProps<'a'>, 'href'> & {
    href: string | { pathname: string; hash: string }
  }) => (
    <a {...props} href={typeof href === 'string' ? href : `/en#${href.hash}`}>
      {children}
    </a>
  ),
}))

test('homepage shortcuts open the author page and jump to hikes without dropping the query', () => {
  window.history.replaceState(null, '', '/en?offset=6')
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <Navigation locale="en" />
      <section id="hikes">Hike cards</section>
    </NextIntlClientProvider>,
  )
  const author = screen.getByText('About me')
  const visit = jest.fn((event: Event) => {
    event.preventDefault()
  })
  author.addEventListener('click', visit)
  fireEvent.keyDown(window, { key: 'a' })
  expect(visit).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(window, { key: 'h' })
  expect(window.location.hash).toBe('#hikes')
  expect(window.location.search).toBe('?offset=6')
})

test('shortcut help opens with ? and turning off character keys removes shortcut metadata', () => {
  window.history.replaceState(null, '', '/en')
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <Navigation locale="en" />
      <KeyboardShortcuts />
    </NextIntlClientProvider>,
  )
  const dialog = container.querySelector('dialog')
  if (!dialog) {
    throw new Error('Missing shortcut help dialog')
  }
  dialog.showModal = jest.fn(() => {
    dialog.open = true
  })
  dialog.close = jest.fn(() => {
    dialog.open = false
  })

  try {
    expect(screen.getByRole('link', { name: 'About me' })).toHaveAttribute('aria-keyshortcuts', 'A')
    expect(screen.getByRole('link', { name: 'Hikes' })).toHaveAttribute('aria-keyshortcuts', 'H')
    expect(container.querySelector('nav kbd')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: '?', shiftKey: true })
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Enable single-character page shortcuts' }),
    )
    expect(window.localStorage.getItem('character-shortcuts')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(screen.getByRole('link', { name: 'Hikes' })).not.toHaveAttribute('aria-keyshortcuts')
    fireEvent.keyDown(window, { key: '?', shiftKey: true })
    expect(dialog).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }))
    expect(dialog).toHaveAttribute('open')
  } finally {
    window.localStorage.removeItem('character-shortcuts')
  }
})

test.each([
  ['sv', 'en'],
  ['en', 'cs'],
  ['cs', 'sv'],
] as const)('L switches from %s to %s in menu order', (locale, target) => {
  render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <LanguageSwitcher locale={locale} />
    </NextIntlClientProvider>,
  )
  fireEvent.keyDown(window, { key: 'l' })
  const query = new URLSearchParams({
    locale,
    target,
    pathname: '/hikes/[slug]',
    params: JSON.stringify({ slug: 'forest-trail' }),
    fallback: 'home',
  })
  expect(mockPush).toHaveBeenCalledWith(`/api/language?${query.toString()}`, { scroll: false })
})

test('selecting the current page section closes the main menu and releases its scroll lock', async () => {
  window.history.replaceState(null, '', '/en')
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <Navigation locale="en" />
      <section id="hikes">Hike cards</section>
    </NextIntlClientProvider>,
  )
  fireEvent.keyDown(screen.getByRole('button', { name: 'Navigation' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Hikes' }))
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })
  expect(window.location.hash).toBe('#hikes')
})
