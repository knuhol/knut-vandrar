import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { Fields } from '@/app/admin/ui/Fields'
import { EditorSections } from '@/app/admin/ui/EditorSections'
import { schemaFor, type Json } from '@/admin/resources'
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

test('localized page sections start closed, track edits, and clear changes after reverting', () => {
  render(<PageEditor />)
  expect(screen.queryByText('English content')).not.toBeInTheDocument()
  const content = screen.getByRole('button', { name: 'Content' })
  expect(content).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(content)
  const title = screen.getByRole('textbox', { name: /^title/ })
  expect(title).toHaveValue('Poznámky')
  fireEvent.change(title, { target: { value: 'Nový název' } })
  expect(screen.getByRole('button', { name: /Content Unsaved changes/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Page and publication' })).toBeInTheDocument()
  fireEvent.change(title, { target: { value: 'Poznámky' } })
  expect(screen.queryByText(messages.unsavedChanges)).not.toBeInTheDocument()
})
