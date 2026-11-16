import { photoText, photoTextChanged, type GalleryPhoto } from '@/admin/galleryText'

const source: GalleryPhoto = {
  id: 'photo-1',
  hike_id: 'hike-1',
  sort_order: 0,
  width: 1200,
  height: 800,
  thumbnail_url: '/thumbnail.webp',
  image_url: '/image.webp',
  alt: 'Forest by a lake',
  caption: 'First night',
  translation: { locale: 'en' },
}
const swedish: GalleryPhoto = {
  ...source,
  alt: 'Skog vid en sjö',
  caption: 'Första natten',
  translation: { locale: 'sv' },
}

describe('gallery translation drafts', () => {
  test('loads the saved text for the requested locale', () => {
    expect(photoText(source, 'en')).toEqual({ alt: source.alt, caption: source.caption })
    expect(photoText(swedish, 'sv')).toEqual({ alt: swedish.alt, caption: swedish.caption })
  })

  test.each(['sv', 'cs'] as const)('does not save English fallback as %s text', (locale) => {
    expect(photoText(source, locale)).toEqual({ alt: '', caption: '' })
  })

  test('starts empty for a missing photo', () => {
    expect(photoText(undefined, 'cs')).toEqual({ alt: '', caption: '' })
  })

  test('normalizes a missing caption without discarding the description', () => {
    expect(photoText({ ...swedish, caption: null }, 'sv')).toEqual({
      alt: swedish.alt,
      caption: '',
    })
  })

  test('tracks caption changes and clears dirty state when reverted', () => {
    const baseline = photoText(swedish, 'sv')
    const draft = { ...baseline, caption: 'Andra natten' }

    expect(draft.alt).toBe(baseline.alt)
    expect(photoTextChanged(draft, baseline)).toBe(true)
    expect(photoTextChanged({ ...draft, caption: baseline.caption }, baseline)).toBe(false)
    expect(swedish.caption).toBe('Första natten')
  })

  test('tracks description-only edits, including clearing existing text', () => {
    const baseline = photoText(swedish, 'sv')

    expect(photoTextChanged({ ...baseline, alt: '' }, baseline)).toBe(true)
    expect(photoTextChanged({ ...baseline }, baseline)).toBe(false)
  })
})
