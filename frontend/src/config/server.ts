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

export const serverConfig = {
  deploymentEnvironment: environment,
  apiBaseUrl: (process.env.INTERNAL_API_URL || publicConfig.apiBaseUrl).replace(/\/$/, ''),
  siteOrigin: websiteOrigin(),
}
