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

function analyticsMeasurementId() {
  const id = process.env.GOOGLE_ANALYTICS_ID?.trim() || null
  if (id && !/^G-[A-Z0-9]+$/.test(id)) {
    throw new Error('GOOGLE_ANALYTICS_ID must be a GA4 Measurement ID')
  }
  return environment === 'prod' ? id : null
}

export const serverConfig = {
  analyticsMeasurementId: analyticsMeasurementId(),
  deploymentEnvironment: environment,
  apiBaseUrl: (process.env.INTERNAL_API_URL || publicConfig.apiBaseUrl).replace(/\/$/, ''),
  siteOrigin: websiteOrigin(),
}
