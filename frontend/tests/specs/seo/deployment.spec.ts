import { deploymentEnvironment } from '@/config/deployment.mjs'

test('requires an explicit production deployment to enable indexing', () => {
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' })
  delete process.env.DEPLOYMENT_ENVIRONMENT
  expect(deploymentEnvironment()).toBe('local')
  process.env.DEPLOYMENT_ENVIRONMENT = 'prod'
  expect(deploymentEnvironment()).toBe('prod')
  process.env.DEPLOYMENT_ENVIRONMENT = 'preview-typo'
  expect(() => deploymentEnvironment()).toThrow('DEPLOYMENT_ENVIRONMENT')
})
