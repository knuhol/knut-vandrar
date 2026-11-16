import nextJest from 'next/jest.js'

// Set this in the runner, before Jest creates workers and their environment copies.
process.env.TZ = 'Europe/Stockholm'

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  restoreMocks: true,
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/specs/**/*.spec.{ts,tsx,mjs}'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}

export default createJestConfig(config)
