import { render, screen } from '@testing-library/react'

import { AdminMessage } from '@/app/admin/ui/AdminMessage'

describe('AdminMessage', () => {
  test.each([
    ['plain text', 'Saving failed. Try again.'],
    ['malformed JSON', '{"detail": incomplete'],
    ['HTML-like text', '<img src=x onerror="alert(1)">'],
  ])('shows %s literally in an accessible alert', (_kind, message) => {
    render(<AdminMessage message={message} severity="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByRole('code')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('formats JSON API errors as readable code', () => {
    const error = { detail: [{ loc: ['body', 'title'], msg: 'Field required' }] }
    render(<AdminMessage message={JSON.stringify(error)} severity="error" />)

    expect(screen.getByRole('code').textContent).toBe(JSON.stringify(error, null, 2))
    expect(screen.getByRole('alert')).toHaveTextContent('Field required')
  })
})
