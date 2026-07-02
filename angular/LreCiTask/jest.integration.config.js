const path = require('path');
const integrationRoot = path.resolve(__dirname, '../../../integration');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [integrationRoot],
  testMatch: ['**/__tests__/**/*.integration.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': path.resolve(__dirname, 'src/$1'),
  },
  // Run tests serially (important for integration tests that share state)
  maxWorkers: 1,
  // Longer timeout for integration tests
  testTimeout: 120000, // 2 minutes default
  // Verbose output
  verbose: true,
  // Collect coverage from integration tests
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  // Global setup/teardown
  globalSetup: path.resolve(integrationRoot, 'test-utils/global-setup.ts'),
  globalTeardown: path.resolve(integrationRoot, 'test-utils/global-teardown.ts'),
};
