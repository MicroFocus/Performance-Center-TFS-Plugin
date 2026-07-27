/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Run tests found under angular/src/
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      // Suppress ts-jest type-checking — types are validated by `npm run typecheck`
      diagnostics: false,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
};

