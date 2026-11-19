import 'server-only'

import { publicConfig } from './public'
import { deploymentEnvironment } from './deployment.mjs'
import { siteIdentity } from './site'

const environment = deploymentEnvironment()

function websiteOrigin() {
  const origin = new URL(process.env.SITE_URL || siteIdentity.productionUrl)

  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    (environment === 'prod' && origin.protocol !== 'https:')
  ) {
    throw new Error(
      'SITE_URL must be a website origin without credentials, path, query, or fragment; production requires HTTPS',
    )
  }
  return origin.origin
}

function analyticsConfig() {
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim() || null
  const scriptUrl = process.env.UMAMI_SCRIPT_URL?.trim() || null
  if (!websiteId) {
    return null
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(websiteId)) {
    throw new Error('UMAMI_WEBSITE_ID must be a website UUID')
  }
  const url = new URL(scriptUrl || '')
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('UMAMI_SCRIPT_URL must be an HTTPS URL without credentials, query, or fragment')
  }
  return environment === 'prod' ? { websiteId, scriptUrl: url.href } : null
}

export const serverConfig = {
  analytics: analyticsConfig(),
  deploymentEnvironment: environment,
  apiBaseUrl: (process.env.INTERNAL_API_URL || publicConfig.apiBaseUrl).replace(/\/$/, ''),
  siteOrigin: websiteOrigin(),
}
