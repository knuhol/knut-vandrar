import 'server-only'

import path from 'node:path'

import { serverConfig } from '@/config/server'

export const previewConfig = {
  enabled: serverConfig.deploymentEnvironment === 'dev',
  origin: 'https://dev.vandrar.se',
  passwordHash: process.env.DEV_GATE_PASSWORD_HASH || '',
  database: process.env.DEV_GATE_DATABASE || path.resolve('.preview/attempts.sqlite'),
  cookie: '__Host-dev_access',
  sessionSeconds: 8 * 60 * 60,
}

export const previewHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
}

export function previewHost(host: string | null) {
  return previewConfig.enabled && host === new URL(previewConfig.origin).host
}

export function localPreviewHost(host: string | null) {
  return (
    serverConfig.deploymentEnvironment === 'local' &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host || '')
  )
}

export function previewDestination(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) {
    return '/'
  }
  const url = new URL(value, previewConfig.origin)
  return url.origin === previewConfig.origin && url.pathname !== '/preview'
    ? `${url.pathname}${url.search}`
    : '/'
}
