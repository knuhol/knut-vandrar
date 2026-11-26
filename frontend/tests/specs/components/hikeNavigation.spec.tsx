import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { HikeOverview } from '@/app/[locale]/hikes/[slug]/components/HikeOverview/HikeOverview'
import { HikeNavigation } from '@/app/[locale]/hikes/[slug]/components/HikeNavigation'
import { ActivityContext } from '@/components/HikeActivity'
import { ReadingNavigationProvider } from '@/components/ReadingNavigation'
import { PageMotion } from '@/components/PageMotion'
import { SiteHeader } from '@/components/SiteHeader/SiteHeader'

jest.mock('next/navigation', () => ({ usePathname: () => '/en/hikes/test' }))

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const items = [
  { id: 'story' as const, label: 'The story' },
  { id: 'photos' as const, label: 'Photographs' },
]

beforeEach(() => {
  window.history.replaceState(null, '', '/en/hikes/test')
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  globalThis.ResizeObserver = class {
    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()
  }
  HTMLElement.prototype.scrollIntoView = jest.fn()
  jest.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000)
})

test('supports keyboard section selection and closes the picker after choosing a section', async () => {
  render(
    <ReadingNavigationProvider>
      <SiteHeader
        brand={<span>Brand</span>}
        navigation={<a href="#home">Home</a>}
        languages={<span>EN</span>}
      />
      <HikeNavigation label="Sections" items={items} />
    </ReadingNavigationProvider>,
  )
  const toggle = await screen.findByRole('button', { name: 'The story' })
  fireEvent.keyDown(toggle, { key: 'ArrowDown' })
  const destination = await screen.findByRole('menuitem', { name: 'Photographs' })
  fireEvent.click(destination)
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: 'Photographs' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('moves reading controls into the existing header and preserves chapter and site navigation access', async () => {
  const { container } = render(
    <ActivityContext.Provider value={{ slug: 'test', sending: true }}>
      <ReadingNavigationProvider>
        <SiteHeader
          brand={<span>Brand</span>}
          navigation={<a href="#home">Site navigation</a>}
          languages={<span>EN</span>}
          hikeAction={<a href="#map">Hiking now</a>}
        />
        <HikeNavigation label="Sections" items={items} />
        <article id="story">
          <details id="preparation" data-chapter open>
            <summary>Preparation</summary>
            <p>Chapter content</p>
          </details>
        </article>
      </ReadingNavigationProvider>
    </ActivityContext.Provider>,
  )
  const sentinel = container.querySelector<HTMLElement>('[data-hike-navigation]')
  const chapter = container.querySelector<HTMLDetailsElement>('#preparation')
  const summary = chapter?.querySelector('summary')
  if (!sentinel || !chapter || !summary) {
    throw new Error('Missing reading landmarks')
  }
  const position = jest
    .spyOn(sentinel, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, -1, 800, 56))
  jest.spyOn(chapter, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, -1, 800, 500))
  fireEvent.scroll(window)
  const header = screen.getByRole('banner')
  expect(sentinel).toBeEmptyDOMElement()
  await within(header).findByRole('button', { name: 'The story / Preparation' })
  const hikeAction = within(header).getByRole('link', { name: 'Hiking now' })
  expect(hikeAction.closest('[inert]')).toBeNull()
  expect(container.querySelectorAll('[data-site-header]')).toHaveLength(1)
  expect(within(header).queryByRole('button', { name: 'collapseChapter' })).not.toBeInTheDocument()
  const menu = within(header).getByRole('button', { name: 'showMainMenu' })
  expect(menu.querySelector('svg')).toHaveClass('tabler-icon-arrow-right')
  fireEvent.click(menu)
  expect(within(header).getByRole('link', { name: 'Hiking now' })).toBe(hikeAction)
  expect(menu.querySelector('svg')).toHaveClass('tabler-icon-arrow-left')
  expect(within(header).getByRole('link', { name: 'Site navigation' })).toBeInTheDocument()
  expect(within(header).queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
  fireEvent.keyDown(menu, { key: 'Escape' })
  expect(menu).toHaveAttribute('aria-expanded', 'true')

  fireEvent.click(menu)
  position.mockReturnValue(new DOMRect(0, 500, 800, 0))
  fireEvent.scroll(window)
  await waitFor(() => {
    expect(within(header).queryByRole('button', { name: 'showSubmenu' })).not.toBeInTheDocument()
  })

  position.mockReturnValue(new DOMRect(0, -1, 800, 0))
  fireEvent.scroll(window)
  await within(header).findByRole('button', { name: 'The story / Preparation' })
  expect(within(header).getByRole('button', { name: 'showMainMenu' })).toBeInTheDocument()
})

test('keeps contextual navigation available when jumping back to the map overview', async () => {
  const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const { container } = render(
    <ReadingNavigationProvider>
      <SiteHeader
        brand={<span>Brand</span>}
        navigation={<a href="#home">Home</a>}
        languages={<span>EN</span>}
      />
      <PageMotion />
      <HikeNavigation
        label="Sections"
        items={[
          { id: 'resources', label: 'More from this hike' },
          { id: 'photos', label: 'Photographs' },
        ]}
      />
      <HikeOverview map={<section id="map">Map overview</section>}>Resource links</HikeOverview>
      <section id="photos">Photos</section>
    </ReadingNavigationProvider>,
  )
  const sentinel = container.querySelector<HTMLElement>('[data-hike-navigation]')
  const overview = document.getElementById('resources')
  const photos = document.getElementById('photos')
  if (!sentinel || !overview || !photos) {
    throw new Error('Missing overview landmarks')
  }
  const position = jest
    .spyOn(sentinel, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, -1, 800, 0))
  const overviewPosition = jest
    .spyOn(overview, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, -500, 800, 500))
  const photoPosition = jest.spyOn(photos, 'getBoundingClientRect')
  fireEvent.scroll(window)
  const header = screen.getByRole('banner')
  const trigger = await within(header).findByRole('button', { name: 'Photographs' })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const destination = await screen.findByRole('menuitem', { name: 'More from this hike' })
  expect(document.body).toHaveAttribute('data-scroll-locked')
  fireEvent.click(destination)
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  await waitFor(() => {
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })
  await waitFor(() => {
    expect(scroll).toHaveBeenCalled()
  })
  expect(window.location.hash).toBe('#resources')
  position.mockReturnValue(new DOMRect(0, 0.5, 800, 0))
  overviewPosition.mockReturnValue(new DOMRect(0, 0.5, 800, 500))
  photoPosition.mockReturnValue(new DOMRect(0, 500, 800, 500))
  fireEvent.scroll(window)
  const mapTrigger = await within(header).findByRole('button', { name: 'More from this hike' })
  fireEvent.keyDown(mapTrigger, { key: 'ArrowDown' })
  expect(await screen.findByRole('menuitem', { name: 'Photographs' })).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

  position.mockReturnValue(new DOMRect(0, 500, 800, 0))
  fireEvent.scroll(window)
  await waitFor(() => {
    expect(within(header).getByRole('link', { name: 'Home' })).toBeInTheDocument()
  })
})

test('closing the section picker restores focus without scrolling the sticky header into view', async () => {
  render(
    <ReadingNavigationProvider>
      <SiteHeader
        brand={<span>Brand</span>}
        navigation={<a href="#home">Home</a>}
        languages={<span>EN</span>}
      />
      <HikeNavigation label="Sections" items={items} />
    </ReadingNavigationProvider>,
  )
  const trigger = await screen.findByRole('button', { name: 'The story' })
  const focus = jest.spyOn(trigger, 'focus')
  fireEvent(trigger, new MouseEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }))
  await screen.findByRole('menu')
  const closePointer = new MouseEvent('pointerdown', {
    button: 0,
    bubbles: true,
    cancelable: true,
  })
  fireEvent(trigger, closePointer)
  expect(closePointer.defaultPrevented).toBe(true)
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })
  expect(focus.mock.calls.every(([options]) => options?.preventScroll === true)).toBe(true)
})
