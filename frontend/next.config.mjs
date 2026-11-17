import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import nextEnv from '@next/env'
import createNextIntlPlugin from 'next-intl/plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const loadEnvConfig = Reflect.get(nextEnv, 'loadEnvConfig')

// Also load the repository-root .env for commands run from frontend/.
loadEnvConfig(
  path.resolve(__dirname, '..'),
  process.env.NODE_ENV === 'development',
  undefined,
  true,
)

/** @type {import('next').NextConfig} */
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL
if (!publicApiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured before the frontend builds')
}

const nextConfig = {
  // Let next-intl resolve the original localized URL before rewriting it.
  // Normalizing first can redirect rewritten routes back to their public URL.
  skipProxyUrlNormalize: true,
  outputFileTracingRoot: fs.existsSync(path.join(path.resolve(__dirname, '..'), 'frontend'))
    ? path.resolve(__dirname, '..')
    : __dirname,
  // This is intentionally public and contains no credentials.
  env: { NEXT_PUBLIC_API_URL: publicApiUrl },
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
export default withNextIntl(nextConfig)
