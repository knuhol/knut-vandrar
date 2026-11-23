import { render, screen, within } from '@testing-library/react'

import type { Hike } from '@/api/hikes'
import { HikeMasthead } from '@/app/[locale]/hikes/[slug]/components/HikeMasthead/HikeMasthead'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/navigation', () => ({ Link: 'a' }))
jest.mock('@/config/breakpoints', () => ({ responsiveMedia: {} }))

test.each(['Sörmland · Southeastern Sweden', null])(
  'renders the optional location above the title and keeps the season off the cover (%s)',
  (geographicLabel) => {
    const hike = {
      status: 'completed',
      actual_start_at: '2026-06-01T12:00:00Z',
      translation: { title: 'Sörmlandsleden', geographic_label: geographicLabel },
    } as Hike
    render(<HikeMasthead hike={hike} />)

    const cover = within(screen.getByRole('banner'))
    const title = cover.getByRole('heading', { level: 1, name: 'Sörmlandsleden' })
    expect(cover.getByText('completed')).toBeVisible()
    expect(cover.queryByText('hikeSeason')).not.toBeInTheDocument()

    if (geographicLabel) {
      expect(title.previousElementSibling).toHaveTextContent(geographicLabel)
    } else {
      expect(title.previousElementSibling).toHaveTextContent('completed')
    }
  },
)
