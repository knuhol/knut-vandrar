import assert from 'node:assert/strict'

import { photoText, photoTextChanged } from '../src/admin/galleryText.ts'

const source = { alt: 'Forest by a lake', caption: 'First night', translation: { locale: 'en' } }
const swedish = { alt: 'Skog vid en sjö', caption: 'Första natten', translation: { locale: 'sv' } }
assert.deepEqual(photoText(source, 'en'), { alt: source.alt, caption: source.caption })
assert.deepEqual(
  photoText(source, 'sv'),
  { alt: '', caption: '' },
  'English fallback is not a saved Swedish translation',
)
assert.deepEqual(photoText(undefined, 'cs'), { alt: '', caption: '' })
const baseline = photoText(swedish, 'sv')
const editedCaption = { ...baseline, caption: 'Andra natten' }
assert.equal(editedCaption.alt, baseline.alt, 'Caption edits preserve the existing description')
assert.equal(photoTextChanged(editedCaption, baseline), true)
assert.equal(
  photoTextChanged({ ...editedCaption, caption: baseline.caption }, baseline),
  false,
  'Reverting text clears its dirty state',
)
assert.deepEqual(photoText({ ...swedish, caption: null }, 'sv'), { alt: swedish.alt, caption: '' })
process.stdout.write('Gallery translation draft checks passed.\n')
