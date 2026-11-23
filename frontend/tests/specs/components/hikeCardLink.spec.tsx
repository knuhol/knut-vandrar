import { fireEvent, render, screen } from '@testing-library/react'
import { prefetchHikeCover } from '@/hiking/prefetchCovers'

import { HikeCardLink } from '@/app/[locale]/components/HikeCardLink'

jest.mock('@/hiking/prefetchCovers', () => ({ prefetchHikeCover: jest.fn() }))
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

test.each([fireEvent.focus, fireEvent.pointerEnter])(
  'warms the cover on card intent',
  (trigger) => {
    const covers = {
      full: 'https://api.example.test/cover?v=large',
      desktop: 'https://api.example.test/cover?variant=desktop&v=desktop',
      mobile: 'https://api.example.test/cover?variant=mobile&v=medium',
      card: 'https://api.example.test/cover?variant=card&v=small',
    }
    render(
      <HikeCardLink slug="example" covers={covers} label="View example">
        View
      </HikeCardLink>,
    )

    expect(prefetchHikeCover).not.toHaveBeenCalled()
    trigger(screen.getByRole('button', { name: 'View example' }))
    expect(prefetchHikeCover).toHaveBeenCalledWith(covers, 'high')
  },
)
