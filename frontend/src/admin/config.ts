import 'server-only'

import path from 'node:path'

export const adminConfig = {
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  apiToken: process.env.API_WRITE_TOKEN || '',
  origin: process.env.ADMIN_ORIGIN || '',
  database: process.env.ADMIN_SESSION_DATABASE || path.resolve('.admin/sessions.sqlite'),
  sessionSeconds: 60 * 60 * 8,
  cookie: 'admin_session',
}
