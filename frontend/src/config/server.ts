import 'server-only'

import { publicConfig } from './public'

export const serverConfig = {
  apiBaseUrl: (process.env.INTERNAL_API_URL || publicConfig.apiBaseUrl).replace(/\/$/, ''),
  revalidationSecret: process.env.CACHE_REVALIDATION_SECRET,
}
