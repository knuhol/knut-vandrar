import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import nextEnv from '@next/env'

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
  outputFileTracingRoot: fs.existsSync(path.join(path.resolve(__dirname, '..'), 'frontend'))
    ? path.resolve(__dirname, '..')
    : __dirname,
  // This is intentionally public and contains no credentials.
  env: { NEXT_PUBLIC_API_URL: publicApiUrl },
}

export default nextConfig
