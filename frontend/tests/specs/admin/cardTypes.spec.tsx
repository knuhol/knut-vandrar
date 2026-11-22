import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { Fields } from '@/app/admin/ui/Fields'
import { record, schemaFor, type Json } from '@/admin/resources'

jest.mock('@/admin/client', () => ({ api: jest.fn() }))
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))

function CardsEditor({ status = 'ongoing' }: { status?: string }) {
  const [cards, setCards] = useState<Json>([])
  const schema = schemaFor('HikeWrite').properties?.cards
  if (!schema) {
    throw new Error('Missing card schema')
  }
  return (
    <>
      <Fields
        schema={schema}
        context={{ schema: 'HikeWrite', value: { status } }}
        value={cards}
        label="cards"
        onChange={setCards}
      />
      <output data-testid="cards">{JSON.stringify(cards)}</output>
    </>
  )
}

function types() {
  return (JSON.parse(screen.getByTestId('cards').textContent || '[]') as Json[]).map(
    (card) => record(card).type,
  )
}

test('adds only unused card types, prevents duplicate type changes, and restores removed types', () => {
  render(<CardsEditor />)
  const add = screen.getByRole('button', { name: /Add.*cards/i })
  fireEvent.click(add)
  fireEvent.click(add)
  expect(types()).toEqual(['route', 'gpx_collection'])
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'cards 2 type' }))
  expect(screen.queryByRole('option', { name: 'route' })).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'gpx collection' })).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

  for (let index = 0; index < 5; index++) {
    fireEvent.click(add)
  }
  expect(types()).toHaveLength(7)
  expect(new Set(types()).size).toBe(7)
  expect(add).toBeDisabled()
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
  expect(add).toBeEnabled()
  fireEvent.click(add)
  expect(types().at(-1)).toBe('route')
  expect(new Set(types()).size).toBe(7)
})

test('does not offer live tracking after all applicable finished-hike card types are used', () => {
  render(<CardsEditor status="completed" />)
  const add = screen.getByRole('button', { name: /Add.*cards/i })
  for (let index = 0; index < 6; index++) {
    fireEvent.click(add)
  }
  expect(types()).toHaveLength(6)
  expect(types()).not.toContain('live_position')
  expect(add).toBeDisabled()
})
