import 'server-only'

import { publicConfig } from './public'

export const serverConfig = {
  apiBaseUrl: (process.env.INTERNAL_API_URL || publicConfig.apiBaseUrl).replace(/\/$/, ''),
}
