import { siteIdentity } from '@/config/site'

function completedYearsSince(date: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: siteIdentity.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((value) => value.type === type)?.value)
  const [year, month, day] = date.split('-').map(Number)
  const beforeAnniversary = part('month') < month || (part('month') === month && part('day') < day)

  return part('year') - year - Number(beforeAnniversary)
}

export function getAuthorAge(now: Date) {
  return completedYearsSince(siteIdentity.authorBirthDate, now)
}

export function getYearsInSweden(now: Date) {
  return completedYearsSince(siteIdentity.authorSwedenMoveDate, now)
}

export function formatAuthorContent(content: string, now: Date) {
  return content
    .replaceAll('[current_age]', String(getAuthorAge(now)))
    .replaceAll('[years_in_sweden]', String(getYearsInSweden(now)))
}
