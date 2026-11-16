import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'

import { routing } from './i18n/routing'
import { deploymentEnvironment } from './config/deployment.mjs'

const internationalize = createMiddleware(routing)

export default function proxy(request: NextRequest) {
  const response = internationalize(request)
  if (deploymentEnvironment() !== 'prod') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return response
}
export const config = { matcher: ['/((?!admin(?:/|$)|api|_next|brand|.*\\..*).*)'] }
