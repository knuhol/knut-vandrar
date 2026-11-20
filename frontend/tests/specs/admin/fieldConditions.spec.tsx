import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { Fields } from '@/app/admin/ui/Fields'
import { EditorSections } from '@/app/admin/ui/EditorSections'
import { fieldApplies, prepareDraft, prepareWrite, variantApplies } from '@/admin/fieldConditions'
import { initialValue, record, schemaFor, type Json } from '@/admin/resources'

jest.mock('@/admin/client', () => ({ api: jest.fn() }))
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))

function Editor({ schemaName, initial }: { schemaName: string; initial: Json }) {
  const schema = schemaFor(schemaName)
  const [value, setValue] = useState(initial)
  return (
    <EditorSections>
      <Fields
        schema={schema}
        value={value}
        baseline={initial}
        label="Editor"
        onChange={(next) => {
          setValue(prepareDraft(schema, next))
        }}
      />
      <output data-testid="draft">{JSON.stringify(value)}</output>
    </EditorSections>
  )
}

function select(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }))
  fireEvent.click(screen.getByRole('option', { name: option }))
}

test('status changes update fields across sections and preserve hidden stopping edits', () => {
  const initial = {
    ...record(initialValue(schemaFor('HikeWrite'))),
    status: 'aborted',
    stop_latitude: 59,
    stop_longitude: 15,
    stop_stage: '11',
  }
  render(<Editor schemaName="HikeWrite" initial={initial} />)
  fireEvent.click(screen.getByRole('button', { name: /Route and coordinates/ }))
  expect(screen.getByRole('spinbutton', { name: 'stop latitude' })).toHaveValue(59)
  expect(screen.getByRole('textbox', { name: 'stop stage' })).toHaveValue('11')
  fireEvent.click(screen.getByRole('button', { name: /Status, location and dates/ }))
  select('status', 'completed')
  fireEvent.click(screen.getByRole('button', { name: /Route and coordinates/ }))
  expect(screen.queryByRole('spinbutton', { name: 'stop latitude' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'stop stage' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Status, location and dates/ }))
  select('status', 'aborted')
  fireEvent.click(screen.getByRole('button', { name: /Route and coordinates/ }))
  expect(screen.getByRole('textbox', { name: 'stop stage' })).toHaveValue('11')
})

test('named route fields follow scope and retain edits when toggled', () => {
  render(
    <Editor
      schemaName="HikeWrite"
      initial={{
        ...record(initialValue(schemaFor('HikeWrite'))),
        route_scope: 'named_hiking_route',
        named_route_name: 'Treparksmötet',
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Route and coordinates/ }))
  expect(screen.getByRole('textbox', { name: 'named route name' })).toHaveValue('Treparksmötet')
  select('route scope', 'custom route')
  expect(screen.queryByRole('textbox', { name: 'named route name' })).not.toBeInTheDocument()
  select('route scope', 'named hiking route')
  expect(screen.getByRole('textbox', { name: 'named route name' })).toHaveValue('Treparksmötet')
})

test('unknown practical information hides options and submission clears invalid dependencies without mutating drafts', () => {
  const schema = schemaFor('LocationWrite')
  const value = {
    ...record(initialValue(schema)),
    kind: 'area',
    is_loop: true,
    water_sources_status: 'unknown',
    water_sources: ['natural'],
    overnight_options_status: 'unknown',
    overnight_options: ['tent'],
    overnight_restrictions_status: 'unknown',
    overnight_restrictions: ['fees_apply'],
  }
  render(<Editor schemaName="LocationWrite" initial={value} />)
  fireEvent.click(screen.getByRole('button', { name: /Water sources/ }))
  expect(screen.queryByRole('button', { name: /Add.*water sources/i })).not.toBeInTheDocument()
  select('water sources status', 'known')
  expect(screen.getByRole('combobox', { name: 'water sources 1' })).toHaveTextContent('natural')
  const submitted = record(prepareWrite(schema, value))
  expect(submitted).toMatchObject({
    is_loop: null,
    water_sources: [],
    overnight_options: [],
    overnight_restrictions: [],
  })
  expect(value.water_sources).toEqual(['natural'])
  expect(value.is_loop).toBe(true)
})

test.each([
  ['planned', ['planned_start_at', 'planned_end_at']],
  ['ongoing', ['actual_start_at', 'planned_end_at']],
  ['completed', ['actual_start_at', 'actual_end_at']],
  ['aborted', ['actual_start_at', 'actual_end_at', 'stop_latitude', 'stop_longitude']],
])('%s exposes the applicable timestamps and stopping coordinates', (status, expected) => {
  const schema = schemaFor('HikeWrite')
  const value = { status }
  const context = { schema: 'HikeWrite', value }
  const fields = [
    'planned_start_at',
    'planned_end_at',
    'actual_start_at',
    'actual_end_at',
    'stop_latitude',
    'stop_longitude',
  ]
  expect(fields.filter((key) => fieldApplies(schema, key, value, context)).sort()).toEqual(
    [...expected].sort(),
  )
})

test('clearing stopping coordinates or overnight recording time clears dependent submitted values', () => {
  const schema = schemaFor('HikeWrite')
  const value = {
    status: 'aborted',
    stop_latitude: null,
    stop_longitude: null,
    stop_stage: '11',
    overnights_recorded_at: null,
    overnights: [{ accommodation_type: 'tent', night_count: 2 }],
  }
  expect(prepareWrite(schema, value)).toMatchObject({ stop_stage: null, overnights: [] })
  expect(value.stop_stage).toBe('11')
})

test('live tracking variants and credentials follow hike and connection status', () => {
  const schema = schemaFor('LivePositionCard')
  const context = { schema: 'HikeWrite', value: { status: 'completed' } }
  expect(variantApplies(schema, context)).toBe(false)
  context.value.status = 'planned'
  expect(variantApplies(schema, context)).toBe(true)
  expect(fieldApplies(schema, 'password', { state: 'inactive' }, context)).toBe(false)
  expect(fieldApplies(schema, 'url', { state: 'active' }, context)).toBe(true)
  const draft = {
    status: 'completed',
    cards: [
      { type: 'live_position', state: 'active', url: 'https://example.com', password: 'saved' },
    ],
  }
  expect(prepareWrite(schemaFor('HikeWrite'), draft)).toEqual(draft)
})

test('page templates follow the selected page and hide irrelevant template fields', () => {
  const schema = schemaFor('PageWrite')
  const value = prepareDraft(schema, {
    page_key: 'privacy-policy',
    content: { type: 'about', title: 'Shared title', portrait_alt: 'Portrait' },
  })
  expect(record(value).content).toMatchObject({ type: 'standard', title: 'Shared title' })
  expect(record(record(value).content).portrait_alt).toBeUndefined()
  render(<Editor schemaName="PageWrite" initial={value} />)
  fireEvent.click(screen.getByRole('button', { name: 'Content' }))
  expect(screen.queryByRole('combobox', { name: /type/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: /portrait alt/ })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /^title/ })).toHaveValue('Shared title')
})

test('historic hike dates and stopping data survive a status change', () => {
  const value = {
    status: 'completed',
    planned_start_at: '2026-07-01T12:00:00Z',
    planned_end_at: '2026-07-04T12:00:00Z',
    stop_latitude: 59,
    stop_longitude: 15,
    stop_stage: '11',
  }
  expect(prepareWrite(schemaFor('HikeWrite'), value)).toEqual(value)
})

test('inactive tracking fields are removed from the DOM and return with their draft values', () => {
  const initial = {
    ...record(initialValue(schemaFor('HikeWrite'))),
    status: 'planned',
    cards: [
      {
        type: 'live_position',
        state: 'active',
        url: 'https://example.com/track',
        password: 'trail',
      },
    ],
  }
  render(<Editor schemaName="HikeWrite" initial={initial} />)
  fireEvent.click(screen.getByRole('button', { name: 'Information cards' }))
  expect(screen.getByRole('textbox', { name: 'password' })).toHaveValue('trail')
  select('state', 'inactive')
  expect(screen.queryByRole('textbox', { name: 'url' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'password' })).not.toBeInTheDocument()
  select('state', 'active')
  expect(screen.getByRole('textbox', { name: 'password' })).toHaveValue('trail')
})

test('incomplete tracking cards remain editable and invalid hidden URLs do not block saving', () => {
  const context = { schema: 'HikeWrite', value: { status: 'completed' } }
  expect(
    variantApplies(schemaFor('LivePositionCard'), context, {
      type: 'live_position',
      state: null,
    }),
  ).toBe(true)
  const card = { type: 'live_position', state: 'active', url: 'not a URL', password: 'saved' }
  expect(
    prepareWrite(schemaFor('HikeWrite'), { status: 'completed', cards: [card] }),
  ).toMatchObject({
    cards: [{ ...card, url: null }],
  })
  expect(card.url).toBe('not a URL')
})
