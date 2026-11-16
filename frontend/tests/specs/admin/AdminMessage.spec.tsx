import { render, screen } from '@testing-library/react'

import { AdminMessage } from '@/app/admin/ui/AdminMessage'

describe('AdminMessage', () => {
  test('shows plain errors in an accessible alert', () => {
    render(<AdminMessage message="Saving failed. Try again." severity="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Saving failed. Try again.')
    expect(screen.queryByRole('code')).not.toBeInTheDocument()
  })

  test('formats JSON API errors as readable code', () => {
    const error = { detail: [{ loc: ['body', 'title'], msg: 'Field required' }] }
    render(<AdminMessage message={JSON.stringify(error)} severity="error" />)

    expect(screen.getByRole('code').textContent).toBe(JSON.stringify(error, null, 2))
    expect(screen.getByRole('alert')).toHaveTextContent('Field required')
  })

  test('keeps malformed JSON visible as plain text', () => {
    render(<AdminMessage message='{"detail": incomplete' severity="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('{"detail": incomplete')
    expect(screen.queryByRole('code')).not.toBeInTheDocument()
  })

  test('renders message text without interpreting HTML', () => {
    render(<AdminMessage message='<img src=x onerror="alert(1)">' />)

    expect(screen.getByRole('alert')).toHaveTextContent('<img src=x onerror="alert(1)">')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
