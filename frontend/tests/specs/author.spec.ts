import { formatAuthorContent, getAuthorAge, getYearsInSweden } from '@/content/author'

test.each([
  ['2027-01-17T22:59:59Z', 36],
  ['2027-01-17T23:00:00Z', 37],
  ['2027-01-18T12:00:00Z', 37],
  ['2027-12-31T23:00:00Z', 37],
])('calculates age using the Stockholm birthday boundary at %s', (date, age) => {
  expect(getAuthorAge(new Date(date))).toBe(age)
})

test('replaces every occurrence of both supported placeholders', () => {
  expect(
    formatAuthorContent(
      '[current_age] / [years_in_sweden] / [current_age]',
      new Date('2026-11-16T12:00:00Z'),
    ),
  ).toBe('36 / 8 / 36')
})

test.each([
  ['2027-01-02T22:59:59Z', 8],
  ['2027-01-02T23:00:00Z', 9],
  ['2027-01-03T12:00:00Z', 9],
])('counts completed years in Sweden at the Stockholm anniversary boundary %s', (date, years) => {
  expect(getYearsInSweden(new Date(date))).toBe(years)
})
