import { fireEvent, render, screen } from '@testing-library/react'
import { Fields } from '@/app/admin/ui/Fields'
import { api } from '@/admin/client'
import { fieldGroups, referencesFor, resources, schemaFor, type Json } from '@/admin/resources'
import messages from '@/admin/messages/en.json'

jest.mock('@/admin/client', () => ({ api: jest.fn() }))
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))

const hike = resources[0]
const schema = {
  type: 'object',
  properties: { track_collection_id: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
}

function editor(location: string, onChange: (value: Json) => void) {
  const value = { location_id: location, track_collection_id: null }
  return (
    <Fields
      schema={schema}
      value={value}
      onChange={onChange}
      label="Hike"
      bare
      references={referencesFor(hike, value, 'hike-id')}
    />
  )
}

test('collection choices follow the hike and trail and reset after a trail change', async () => {
  const request = jest.mocked(api)
  request.mockResolvedValueOnce({
    items: [{ id: 'first', name: 'Trail northbound', direction: 'forward', hike_id: null }],
    total: 1,
  })
  request.mockResolvedValueOnce({
    items: [{ id: 'second', name: 'Custom hike collection', direction: null, hike_id: 'hike-id' }],
    total: 1,
  })
  const onChange = jest.fn()
  const { rerender } = render(editor('first-trail', onChange))
  fireEvent.mouseDown(screen.getByRole('combobox', { name: messages.trackCollection }))
  fireEvent.click(
    await screen.findByRole('option', { name: /Trail northbound — forward — Trail collection/ }),
  )
  expect(onChange).toHaveBeenCalledWith({
    location_id: 'first-trail',
    track_collection_id: 'first',
  })
  let query = new URL(String(request.mock.calls[0][0]), 'https://example.com')
  expect(query.pathname).toBe('/track-collections')
  expect(query.searchParams.get('location_id')).toBe('first-trail')
  expect(query.searchParams.get('hike_id')).toBe('hike-id')
  rerender(editor('second-trail', onChange))
  fireEvent.mouseDown(screen.getByRole('combobox', { name: messages.trackCollection }))
  await screen.findByRole('option', {
    name: /Custom hike collection — Custom hike collection/,
  })
  expect(request).toHaveBeenCalledTimes(2)
  query = new URL(String(request.mock.calls[1][0]), 'https://example.com')
  expect(query.searchParams.get('location_id')).toBe('second-trail')
  expect(
    screen.queryByRole('option', { name: /Trail northbound — forward — Trail collection/ }),
  ).not.toBeInTheDocument()
})

test('new hikes request trail choices and selection is grouped with route fields', () => {
  expect(referencesFor(hike, { location_id: 'trail' }, '').track_collection_id.filters).toEqual({
    location_id: 'trail',
  })
  expect(referencesFor(hike, { location_id: null }, 'hike-id').track_collection_id.filters).toEqual(
    { hike_id: 'hike-id' },
  )
  const route = fieldGroups(schemaFor('HikeWrite')).find((group) => group.title === 'route')
  expect(route?.fields).toContain('track_collection_id')
  expect(route?.fields).toEqual(
    expect.arrayContaining(['stop_latitude', 'stop_longitude', 'stop_stage']),
  )
})
