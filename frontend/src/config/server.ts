import 'server-only'

import { publicConfig } from './public'

const configuredEnvironment =
  process.env.DEPLOYMENT_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'prod' : 'local')

function deploymentEnvironment(): 'local' | 'dev' | 'prod' {
  if (
    configuredEnvironment === 'local' ||
    configuredEnvironment === 'dev' ||
    configuredEnvironment === 'prod'
  ) {
    return configuredEnvironment
  }
  throw new Error('DEPLOYMENT_ENVIRONMENT must be local, dev, or prod')
}

export const serverConfig = {
  deploymentEnvironment: deploymentEnvironment(),
  apiBaseUrl: (process.env.INTERNAL_API_URL || publicConfig.apiBaseUrl).replace(/\/$/, ''),
}
