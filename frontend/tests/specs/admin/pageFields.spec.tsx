import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { Fields } from '@/app/admin/ui/Fields'
import { EditorSections } from '@/app/admin/ui/EditorSections'
import { fieldGroups, schemaFor, type Json } from '@/admin/resources'
import messages from '@/admin/messages/en.json'

jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))

const saved: Json = {
  page_key: 'czech-translation-notes',
  locale: 'cs',
  published: true,
  indexable: true,
  content: {
    type: 'standard',
    eyebrow: 'Jazyk',
    title: 'Poznámky',
    introduction: 'Úvod',
    body_markdown: 'Text',
  },
}

function PageEditor() {
  const [value, setValue] = useState(saved)
  return (
    <EditorSections>
      <Fields
        schema={schemaFor('PageWrite')}
        value={value}
        baseline={saved}
        onChange={setValue}
        label={messages.pages}
      />
    </EditorSections>
  )
}

test('localized content uses a neutral section without a redundant nested card', () => {
  render(<PageEditor />)
  expect(screen.queryByText('English content')).not.toBeInTheDocument()
  const content = screen.getByRole('button', { name: 'Content' })
  expect(content).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(content)
  expect(screen.getByRole('textbox', { name: /^title/ })).toHaveValue('Poznámky')
  expect(screen.getAllByRole('heading', { name: /^content$/i })).toHaveLength(1)
})

test('editing template content marks only its section and reverting clears the marker', () => {
  render(<PageEditor />)
  fireEvent.click(screen.getByRole('button', { name: 'Content' }))
  const title = screen.getByRole('textbox', { name: /^title/ })
  fireEvent.change(title, { target: { value: 'Nový název' } })
  expect(screen.getByRole('button', { name: /Content Unsaved changes/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Page and publication' })).toBeInTheDocument()
  fireEvent.change(title, { target: { value: 'Poznámky' } })
  expect(screen.queryByText(messages.unsavedChanges)).not.toBeInTheDocument()
})

test('automatically translated entities keep their English source section', () => {
  for (const name of [
    'HikeWrite',
    'LocationWrite',
    'PhotoWrite',
    'RegionWrite',
    'AchievementWrite',
  ]) {
    const group = fieldGroups(schemaFor(name)).find((section) => section.fields.includes('english'))
    expect(group && messages.editorSections[group.title]).toBe('English content')
  }
})
