import { act, fireEvent, render, screen } from '@testing-library/react'

import { HikeOverview } from '@/app/[locale]/hikes/[slug]/components/HikeOverview/HikeOverview'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/navigation/motion', () => ({ motionDuration: () => 0 }))

let resized: () => void

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resized = () => {
        callback([], this)
      }
    }
    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()
  }
})

test('offers scrolling only while more overview content is below the viewport', () => {
  render(
    <HikeOverview map={<div>Map</div>}>
      <p>Resources</p>
    </HikeOverview>,
  )
  const viewport = screen.getByText('Resources').parentElement?.parentElement
  if (!viewport) {
    throw new Error('Missing sidebar viewport')
  }
  let height = 300
  Object.defineProperty(viewport, 'clientHeight', { get: () => height })
  Object.defineProperty(viewport, 'scrollHeight', { get: () => 700 })
  const scrollBy = jest.fn()
  viewport.scrollBy = scrollBy
  act(() => {
    resized()
  })
  expect(screen.getByRole('region', { name: 'hikeFacts' })).toHaveAttribute('tabindex', '0')
  fireEvent.click(screen.getByRole('button', { name: 'scrollForMore' }))
  expect(scrollBy).toHaveBeenCalledWith({ top: 225, behavior: 'instant' })

  viewport.scrollTop = 400
  fireEvent.scroll(viewport)
  expect(screen.queryByRole('button', { name: 'scrollForMore' })).not.toBeInTheDocument()

  viewport.scrollTop = 0
  fireEvent.scroll(viewport)
  expect(screen.getByRole('button', { name: 'scrollForMore' })).toBeInTheDocument()

  height = 800
  act(() => {
    resized()
  })
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'scrollForMore' })).not.toBeInTheDocument()
})
