import 'server-only'

import { createClient, type NormalizeOAS } from 'fets'

import { serverConfig } from '@/config/server'
import type { openapi } from '@/generated/openapi'

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: serverConfig.apiBaseUrl,
  globalParams: { cache: 'no-store' },
})
