import { act, render, screen } from '@testing-library/react'
import { Analytics } from '@/app/[locale]/components/Analytics/Analytics'
import { stopAnalytics } from '@/analytics/umami'

let mockPathname = '/en'
let mockReady: (() => void) | undefined

jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ src, onReady, ...props }: { src: string; onReady: () => void }) => {
    mockReady = onReady
    return <span data-src={src} data-testid="umami-script" {...props} />
  },
}))

const config = {
  websiteId: 'b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d',
  scriptUrl: 'https://umami.vandrar.se/script.js',
}

beforeEach(() => {
  stopAnalytics()
  delete window.umami
  window.localStorage.clear()
  mockPathname = '/en'
  window.history.replaceState(null, '', '/en')
})

test('disabled analytics renders neither a tracker nor consent controls', () => {
  const { container } = render(<Analytics config={null} />)
  expect(container).toBeEmptyDOMElement()
})

test('loads the tracker without consent, sends one initial pageview when ready and follows routes', () => {
  const view = render(<Analytics config={config} />)
  expect(screen.getByTestId('umami-script')).toHaveAttribute('data-src', config.scriptUrl)
  expect(screen.getByTestId('umami-script')).not.toHaveAttribute('data-auto-track')
  expect(screen.getByTestId('umami-script')).toHaveAttribute('data-auto-pageview', 'false')
  expect(screen.getByTestId('umami-script')).toHaveAttribute('data-performance', 'true')
  expect(screen.getByTestId('umami-script')).toHaveAttribute('data-website-id', config.websiteId)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  window.umami = { track: jest.fn() }
  act(() => {
    mockReady?.()
  })
  act(() => {
    mockReady?.()
  })
  expect(window.umami.track).toHaveBeenCalledTimes(1)
  window.history.pushState(null, '', '/en/about')
  mockPathname = '/en/about'
  view.rerender(<Analytics config={config} />)
  expect(window.umami.track).toHaveBeenCalledTimes(2)
  const lateReady = mockReady
  view.rerender(<Analytics config={null} />)
  act(() => {
    lateReady?.()
  })
  expect(window.umami.track).toHaveBeenCalledTimes(2)
  expect(window.umamiBeforeSend?.('event', {})).toBe(false)
})

test('legacy consent and unavailable storage do not gate cookie-free analytics', () => {
  window.localStorage.setItem('knut-analytics-consent', JSON.stringify({ choice: 'rejected' }))
  const storage = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  render(<Analytics config={config} />)
  expect(screen.getByTestId('umami-script')).toBeInTheDocument()
  expect(storage).not.toHaveBeenCalled()
})
