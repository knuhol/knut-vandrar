/** Deployment identity is explicit: a production build can still be a preview. */

export function deploymentEnvironment() {
  const value = process.env.DEPLOYMENT_ENVIRONMENT || 'local'

  if (value === 'local' || value === 'dev' || value === 'prod') {
    return value
  }
  throw new Error('DEPLOYMENT_ENVIRONMENT must be local, dev, or prod')
}
