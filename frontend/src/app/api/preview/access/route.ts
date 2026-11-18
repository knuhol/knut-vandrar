import { NextResponse, type NextRequest } from 'next/server'

import { previewConfig, previewDestination, previewHeaders, previewHost } from '@/preview/config'
import { publicPreviewAsset, validPreviewSession } from '@/preview/security'

export const runtime = 'nodejs'

export function GET(request: NextRequest) {
  if (!previewHost(request.headers.get('x-forwarded-host'))) {
    return new NextResponse(null, { status: 404, headers: previewHeaders })
  }
  const uri = request.headers.get('x-forwarded-uri') || '/'
  const method = request.headers.get('x-forwarded-method') || 'GET'
  if (
    publicPreviewAsset(uri, method) ||
    validPreviewSession(request.cookies.get(previewConfig.cookie)?.value)
  ) {
    return new NextResponse(null, { headers: previewHeaders })
  }
  if (uri.startsWith('/api/') || !['GET', 'HEAD'].includes(method)) {
    return NextResponse.json(
      { error: 'preview_access_required' },
      { status: 401, headers: previewHeaders },
    )
  }
  const gate = new URL('/preview', previewConfig.origin)
  gate.searchParams.set('next', previewDestination(uri))
  return NextResponse.redirect(gate, { status: 303, headers: previewHeaders })
}
