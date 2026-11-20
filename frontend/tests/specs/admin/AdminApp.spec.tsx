import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { AdminApp } from '@/app/admin/ui/AdminApp'
import { api } from '@/admin/client'
import messages from '@/admin/messages/en.json'

jest.mock('@refinedev/core', () => ({
  Refine: ({ children }: { children: ReactNode }) => <>{children}</>,
  useList: () => ({
    result: { data: [{ id: 'hike-id', title: 'Muddus' }], total: 1 },
    query: { refetch: jest.fn() },
  }),
}))
jest.mock('@/admin/client', () => ({ api: jest.fn(), dataProvider: {} }))
jest.mock('@/app/admin/ui/Fields', () => ({ Fields: () => <div>Fields</div> }))
jest.mock('@/app/admin/ui/GalleryEditor', () => ({ GalleryEditor: () => <div>Photo editor</div> }))
jest.mock('@/app/admin/ui/AchievementsEditor', () => ({
  AchievementsEditor: () => <div>Achievement editor</div>,
}))
jest.mock('@/app/admin/ui/Translations', () => ({
  TranslationEditor: () => null,
  TranslationRequest: () => null,
}))
jest.mock('@/app/admin/ui/ImagePreview', () => ({ ImagePreview: () => null }))

test('opening a hike mounts both editors without duplicate sibling keys', async () => {
  jest
    .mocked(api)
    .mockResolvedValue({ id: 'hike-id', status: 'planned', english: { title: 'Muddus' } })
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    render(<AdminApp />)
    fireEvent.click(screen.getByRole('button', { name: messages.edit.trim() }))
    await screen.findByText('Photo editor')
    expect(screen.getByText('Achievement editor')).toBeInTheDocument()
    expect(
      error.mock.calls.some((args) => args.some((value) => String(value).includes('same key'))),
    ).toBe(false)
  } finally {
    error.mockRestore()
  }
})
