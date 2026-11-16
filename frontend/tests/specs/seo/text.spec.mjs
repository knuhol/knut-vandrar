/** @jest-environment node */
import { execFileSync } from 'node:child_process'

// The Markdown ecosystem is ESM. Exercise the actual parser in Node rather than
// mocking it or broadening the application's Jest dependency transformations.
test('converts authored Markdown into clean, bounded metadata text', () => {
  const cases = [
    [
      '## A **long** hike\n\nA [lake](https://example.com) &amp; trees.',
      'A long hike A lake & trees.',
    ],
    ['![Forest](image.webp)\n\n`trail` <strong>notes</strong>', 'Forest trail notes'],
    ['- First\n- Second\n\n> Third', 'First Second Third'],
    ['Visible[^note]\n\n[^note]: Footnote', 'Visible'],
  ]
  const script = `
    import { plainText, metadataDescription } from './src/seo/text.ts';
    const cases = JSON.parse(process.argv[1]);
    console.log(JSON.stringify({ texts: cases.map(([markdown]) => plainText(markdown)), fallback: metadataDescription('', 'Fallback'), bounded: metadataDescription('Long hiking story '.repeat(30), 'Fallback') }));
  `
  const result = JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(cases)], {
      encoding: 'utf8',
    }),
  )
  expect(result.texts).toEqual(cases.map(([, expected]) => expected))
  expect(result.fallback).toBe('Fallback')
  expect(result.bounded.length).toBeLessThanOrEqual(160)
  expect(result.bounded.endsWith('…')).toBe(true)
})
