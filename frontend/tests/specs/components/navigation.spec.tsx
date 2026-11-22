import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'

import { Navigation } from '@/components/Navigation/Navigation'
import { messages } from '@/i18n/messages'

jest.mock('next/navigation', () => ({ usePathname: () => '/en' }))
jest.mock('@/i18n/navigation', () => ({
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
