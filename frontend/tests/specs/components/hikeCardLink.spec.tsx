import { fireEvent, render, screen } from '@testing-library/react'
import * as ReactDOM from 'react-dom'

import { HikeCardLink } from '@/app/[locale]/components/HikeCardLink'

jest.mock('react-dom', () => ({
  ...jest.requireActual<typeof ReactDOM>('react-dom'),
  preload: jest.fn(),
}))
jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: { belowTablet: '(max-width: 639px)' },
}))
jest.mock('@/components/Button', () => ({
  ButtonLink: ({
    'aria-label': label,
    children,
    onFocus,
    onPointerEnter,
  }: React.ComponentProps<'button'>) => (
    <button type="button" aria-label={label} onFocus={onFocus} onPointerEnter={onPointerEnter}>
      {children}
    </button>
  ),
}))

test.each([
  { width: 400, suffix: null, trigger: fireEvent.pointerEnter },
  { width: 900, suffix: '?variant=mobile&v=medium', trigger: fireEvent.focus },
  { width: 1920, suffix: '?variant=mobile&v=medium', trigger: fireEvent.pointerEnter },
])('warms the cover on navigation intent (width: $width)', ({ width, suffix, trigger }) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query === '(max-width: 639px)' && width <= 639,
  }))
  render(
    <HikeCardLink
      slug="example"
      covers={{
        full: 'https://api.example.test/api/hikes/example/cover-image?v=large',
        mobile: 'https://api.example.test/api/hikes/example/cover-image?variant=mobile&v=medium',
        card: 'https://api.example.test/api/hikes/example/cover-image?variant=card&v=small',
      }}
      label="View example"
    >
      View
    </HikeCardLink>,
  )

  expect(ReactDOM.preload).not.toHaveBeenCalled()
  trigger(screen.getByRole('button', { name: 'View example' }))
  if (suffix === null) {
    expect(ReactDOM.preload).not.toHaveBeenCalled()
  } else {
    expect(ReactDOM.preload).toHaveBeenCalledWith(
      `https://api.example.test/api/hikes/example/cover-image${suffix}`,
      { as: 'image', fetchPriority: 'low' },
    )
  }
})
