import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { EditorSection } from '@/app/admin/ui/EditorSection'
import { EditorSections } from '@/app/admin/ui/EditorSections'

test('validation opens and focuses the first invalid section, then advances after correction', async () => {
  const error = jest.spyOn(console, 'error')
  render(
    <form aria-label="Editor">
      <EditorSections>
        <EditorSection title="Route">
          <label>
            Start
            <input required />
          </label>
        </EditorSection>
        <EditorSection title="Content">
          <label>
            Title
            <input required />
          </label>
        </EditorSection>
      </EditorSections>
    </form>,
  )
  const form = screen.getByRole<HTMLFormElement>('form', { name: 'Editor' })
  const route = screen.getByRole('button', { name: 'Route' })
  const content = screen.getByRole('button', { name: 'Content' })
  expect(route).toHaveAttribute('aria-expanded', 'false')
  expect(content).toHaveAttribute('aria-expanded', 'false')

  // Native validation dispatches invalid events and updates section state.
  act(() => {
    expect(form.reportValidity()).toBe(false)
  })
  expect(route).toHaveAttribute('aria-expanded', 'true')
  expect(content).toHaveAttribute('aria-expanded', 'false')
  await waitFor(() => {
    expect(screen.getByLabelText('Start')).toHaveFocus()
  })

  fireEvent.change(screen.getByLabelText('Start'), { target: { value: 'Kloten' } })
  act(() => {
    expect(form.reportValidity()).toBe(false)
  })
  expect(route).toHaveAttribute('aria-expanded', 'false')
  expect(content).toHaveAttribute('aria-expanded', 'true')
  await waitFor(() => {
    expect(screen.getByLabelText('Title')).toHaveFocus()
  })

  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A forest hike' } })
  act(() => {
    expect(form.reportValidity()).toBe(true)
  })
  expect(error).not.toHaveBeenCalled()
})
