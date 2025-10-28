// jest.config.cjs
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js'],
  moduleFileExtensions: ['js', 'mjs'],
  transform: { '\\.m?js$': 'babel-jest' },
  // (opcional)
  globalSetup: '<rootDir>/jest.setup.js',
};
