import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Json } from '@/admin/resources'
import { AchievementsEditor } from '@/app/admin/ui/AchievementsEditor'
import { EditorSections } from '@/app/admin/ui/EditorSections'
import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'

jest.mock('@/admin/client', () => ({ api: jest.fn() }))
const request = jest.mocked(api)
const source = {
  id: 'a1',
  hike_id: 'h1',
  icon: 'tent',
  sort_order: 0,
  title: 'First tent hike',
  description: 'Three nights',
  translation: { locale: 'en', review_status: 'source', is_outdated: false },
}

function editor(dirty = jest.fn()) {
  render(
    <EditorSections>
      <AchievementsEditor hikeId="h1" onDirtyChange={dirty} />
    </EditorSections>,
  )
  fireEvent.click(screen.getByRole('button', { name: /^Achievements/ }))
  return dirty
}

beforeEach(() => {
  request.mockReset()
})

test('saves edited source and manual translations, keeping fallback text out of untranslated fields', async () => {
  request.mockImplementation((path, method, value): Promise<Json> => {
    if (!method) {
      return Promise.resolve({ items: [source], total: 1 })
    }
    const body = value as { title?: string; english?: { title: string; description: string } }
    return Promise.resolve(
      path.endsWith('/sv')
        ? {
            ...source,
            title: body.title || '',
            description: null,
            translation: { locale: 'sv', review_status: 'manual', is_outdated: false },
          }
        : { ...source, ...body.english },
    )
  })
  const dirty = editor()
  await screen.findByRole('heading', { name: source.title })
  expect(screen.getByRole('textbox', { name: messages.galleryLanguages.sv })).toHaveValue('')
  fireEvent.change(screen.getByRole('textbox', { name: messages.galleryLanguages.en }), {
    target: { value: 'First journey' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: messages.galleryLanguages.sv }), {
    target: { value: 'Första vandringen' },
  })
  fireEvent.mouseDown(screen.getByRole('combobox', { name: messages.achievementTextField }))
  fireEvent.click(screen.getByRole('option', { name: messages.achievementDescription }))
  fireEvent.change(screen.getByRole('textbox', { name: messages.galleryLanguages.en }), {
    target: { value: 'Revised description' },
  })
  await waitFor(() => {
    expect(dirty).toHaveBeenLastCalledWith(true)
  })
  fireEvent.click(screen.getByRole('button', { name: messages.save }))
  await screen.findByText(messages.savedNoTranslationsWereQueued)
  expect(request).toHaveBeenCalledWith('achievements/a1', 'PUT', {
    hike_id: 'h1',
    icon: 'tent',
    sort_order: 0,
    english: { title: 'First journey', description: 'Revised description' },
  })
  expect(request).toHaveBeenCalledWith('achievements/a1/translations/sv', 'PUT', {
    title: 'Första vandringen',
    description: null,
  })
  expect(
    request.mock.calls.some(
      ([path]) => path.includes('requeue') || path.includes('/translations/cs'),
    ),
  ).toBe(false)
  await waitFor(() => {
    expect(dirty).toHaveBeenLastCalledWith(false)
  })
})

test('creation retry after a translation failure does not create duplicate achievements', async () => {
  let fail = true
  request.mockImplementation((path, method): Promise<Json> => {
    if (!method) {
      return Promise.resolve({ items: [], total: 0 })
    }
    if (path.endsWith('/sv')) {
      if (fail) {
        fail = false
        return Promise.reject(new Error('Translation failed'))
      }
      return Promise.resolve({
        ...source,
        title: 'Svenska',
        description: null,
        translation: { locale: 'sv', review_status: 'manual', is_outdated: false },
      })
    }
    return Promise.resolve({ ...source, title: 'New title', description: null, icon: 'backpack' })
  })
  editor()
  await waitFor(() => {
    expect(screen.getByRole('button', { name: messages.addAchievement })).toBeEnabled()
  })
  fireEvent.click(screen.getByRole('button', { name: messages.addAchievement }))
  fireEvent.change(screen.getByRole('textbox', { name: messages.galleryLanguages.en }), {
    target: { value: 'New title' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: messages.galleryLanguages.sv }), {
    target: { value: 'Svenska' },
  })
  fireEvent.click(screen.getByRole('button', { name: messages.save }))
  await screen.findByText('Translation failed')
  fireEvent.click(screen.getByRole('button', { name: messages.save }))
  await waitFor(() => {
    expect(screen.queryByText('Translation failed')).not.toBeInTheDocument()
  })
  await waitFor(() => {
    expect(screen.getByRole('button', { name: messages.addAchievement })).toBeEnabled()
  })
  expect(request.mock.calls.filter(([, method]) => method === 'POST')).toHaveLength(1)
  expect(
    request.mock.calls.filter(([path, method]) => path.endsWith('/sv') && method === 'PUT'),
  ).toHaveLength(2)
})

test('deletion requires confirmation and removes the achievement inline', async () => {
  request.mockImplementation((_path, method): Promise<Json> =>
    Promise.resolve(method ? null : { items: [source], total: 1 }),
  )
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
  editor()
  await screen.findByRole('heading', { name: source.title })
  fireEvent.click(screen.getByRole('button', { name: messages.delete.trim() }))
  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: source.title })).not.toBeInTheDocument()
  })
  expect(request).toHaveBeenCalledWith('achievements/a1', 'DELETE')
  expect(confirm).toHaveBeenCalledWith(messages.achievementDeleteConfirmation)
  confirm.mockRestore()
})
