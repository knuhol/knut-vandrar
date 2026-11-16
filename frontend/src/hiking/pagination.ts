export const collectionPageSize = 6

export function collectionOffset(value: string | string[] | undefined) {
  const offset = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 0
  return Number.isSafeInteger(offset)
    ? Math.floor(offset / collectionPageSize) * collectionPageSize
    : 0
}
