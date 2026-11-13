function pad(value: number, width = 2) {
  return String(value).padStart(width, '0')
}

export function localDateTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${day}T${time}.${pad(date.getMilliseconds(), 3)}`
}

export function utcDateTime(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) {
    return undefined
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return undefined
  }
  // Reject invalid dates and nonexistent local times during a daylight-saving jump.
  const normalized =
    value.length === 16
      ? `${value}:00.000`
      : value.includes('.')
        ? value.padEnd(23, '0')
        : `${value}.000`
  return localDateTime(date.toISOString()) === normalized ? date.toISOString() : undefined
}
