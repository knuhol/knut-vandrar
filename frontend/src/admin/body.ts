export async function boundedBody(request: Request, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) {
    return new Uint8Array()
  }
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    let part = await reader.read()
    while (!part.done) {
      const value = part.value
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new Error('Request body exceeds size limit')
      }
      chunks.push(value)
      part = await reader.read()
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
