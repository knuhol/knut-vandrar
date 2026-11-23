import { fireEvent, render, screen } from '@testing-library/react'
import * as ReactDOM from 'react-dom'

import { HikeCardLink } from '@/app/[locale]/components/HikeCardLink'

jest.mock('react-dom', () => ({
  ...jest.requireActual<typeof ReactDOM>('react-dom'),
  preload: jest.fn(),
}))
jest.mock('@/config/public', () => ({ publicConfig: { apiBaseUrl: 'https://api.example.test' } }))
jest.mock('@/config/breakpoints', () => ({
  responsiveMedia: { belowDesktop: 'not all and (min-width: 1024px)' },
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
  { mobile: true, suffix: '?variant=mobile', trigger: fireEvent.focus },
  { mobile: false, suffix: '', trigger: fireEvent.pointerEnter },
])('warms the cover on navigation intent (mobile: $mobile)', ({ mobile, suffix, trigger }) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: mobile })
  render(
    <HikeCardLink slug="example" coverUrl="/api/hikes/example/cover-image" label="View example">
      View
    </HikeCardLink>,
  )

  expect(ReactDOM.preload).not.toHaveBeenCalled()
  trigger(screen.getByRole('button', { name: 'View example' }))
  expect(ReactDOM.preload).toHaveBeenCalledWith(
    `https://api.example.test/api/hikes/example/cover-image${suffix}`,
    { as: 'image', fetchPriority: 'low' },
  )
})
