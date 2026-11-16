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

const resolveConfig = createJestConfig(config)

export default async function jestConfig() {
  const resolved = await resolveConfig()

  return {
    ...resolved,
    // next-intl is ESM-only. Test the real routing configuration and URL builder.
    transformIgnorePatterns: (resolved.transformIgnorePatterns || []).map((pattern) =>
      pattern.replace(
        '/node_modules/',
        '/node_modules/(?!next-intl/|use-intl/|intl-messageformat/|@formatjs/)',
      ),
    ),
  }
}
