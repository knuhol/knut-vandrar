import { fireEvent, render, screen } from '@testing-library/react'

import { DateTimeField } from '@/app/admin/ui/DateTimeField'
import messages from '@/admin/messages/en.json'

describe('DateTimeField', () => {
  test('displays a stored UTC timestamp in the browser time zone', () => {
    render(
      <DateTimeField
        value="2026-07-15T12:34:56.123Z"
        label="Start time"
        required
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByLabelText(/Start time/)).toHaveValue('2026-07-15T14:34:56.123')
    expect(screen.getByText(/Europe\/Stockholm/)).toBeInTheDocument()
  })

  test('saves edits as UTC and clears an optional value as null', () => {
    const onChange = jest.fn()
    render(<DateTimeField value={null} label="End time" required={false} onChange={onChange} />)
    const input = screen.getByLabelText('End time')

    fireEvent.change(input, { target: { value: '2026-01-15T13:34' } })
    expect(onChange).toHaveBeenLastCalledWith('2026-01-15T12:34:00.000Z')

    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  test('rejects nonexistent daylight-saving times and recovers after correction', () => {
    const onChange = jest.fn()
    render(<DateTimeField value={null} label="Start time" required onChange={onChange} />)
    const input = screen.getByLabelText(/Start time/)

    fireEvent.change(input, { target: { value: '2026-03-29T02:30' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toBeInvalid()
    expect(screen.getByText(messages.invalidLocalDateTime)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '2026-03-29T03:30' } })
    expect(onChange).toHaveBeenCalledWith('2026-03-29T01:30:00.000Z')
    expect(input).toBeValid()
    expect(screen.queryByText(messages.invalidLocalDateTime)).not.toBeInTheDocument()
  })
})
