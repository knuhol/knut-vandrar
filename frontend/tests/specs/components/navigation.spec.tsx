import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'

import { HikeLiveBadge } from '@/app/[locale]/components/HikeLiveBadge'
import { ActivityContext } from '@/components/HikeActivity'
import { Navigation } from '@/components/Navigation/Navigation'
import { OngoingHikeLink } from '@/components/Navigation/OngoingHikeLink'
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
  getPathname: ({ href }: { href: { params: { slug: string } } }) =>
    `/en/hikes/${href.params.slug}`,
  Link: ({
    href,
    children,
    ...props
  }: Omit<ComponentProps<'a'>, 'href'> & {
    href:
      string | { pathname: string; hash: string } | { pathname: string; params: { slug: string } }
  }) => (
    <a
      {...props}
      href={
        typeof href === 'string'
          ? href
          : 'params' in href
            ? `/en/hikes/${href.params.slug}`
            : `/en#${href.hash}`
      }
    >
      {children}
    </a>
  ),
}))

test('hovering About me preloads the responsive portrait', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <Navigation locale="en" />
    </NextIntlClientProvider>,
  )

  fireEvent.pointerEnter(screen.getByRole('link', { name: 'About me' }))

  const hint = document.head.querySelector(
    'link[rel="preload"][as="image"][imagesrcset*="knut.webp"]',
  )
  expect(hint).toHaveAttribute(
    'imagesizes',
    '(min-width: 1001px) 50vw, (min-width: 641px) 400px, 100vw',
  )
})

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
  expect(screen.getByText('Show the whole trail')).toBeInTheDocument()
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

test('links to the ongoing hike from its header button', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <OngoingHikeLink locale="en" slug="forest-trail" />
    </NextIntlClientProvider>,
  )

  const link = screen.getByRole('link', { name: 'I’m hiking!' })
  expect(link).toHaveAttribute('href', '/en/hikes/forest-trail')
  expect(link.querySelector('.bg-orange')).toBeInTheDocument()
})

test('the compact ongoing hike link keeps the full accessible label', () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <OngoingHikeLink locale="en" slug="forest-trail" sending />
    </NextIntlClientProvider>,
  )

  const link = screen.getByRole('link', { name: 'I’m hiking!' })
  expect(link).toHaveTextContent('Hiking')
  expect(link.querySelector('.live-position-pulse')).toBeInTheDocument()
})

test.each([true, false])(
  'the card only shows Live for its own fresh tracking status (%s)',
  (sending) => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en}>
        <ActivityContext.Provider value={{ slug: 'forest-trail', sending }}>
          <HikeLiveBadge slug="forest-trail" />
          <HikeLiveBadge slug="another-hike" />
        </ActivityContext.Provider>
      </NextIntlClientProvider>,
    )

    expect(screen.queryAllByText('Live')).toHaveLength(sending ? 1 : 0)
    if (sending) {
      expect(screen.getByText('Live').querySelector('.live-position-pulse')).toBeInTheDocument()
    }
  },
)
