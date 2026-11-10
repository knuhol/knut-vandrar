import { timingSafeEqual } from 'node:crypto'

import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

import { serverConfig } from '@/config/server'

export function POST(request: Request) {
  const expected = serverConfig.revalidationSecret
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  revalidateTag('hikes', { expire: 0 })
  return NextResponse.json({ revalidated: true })
}
