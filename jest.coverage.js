module.exports = {
  collectCoverage: true,
  coverageDirectory: './coverage/',
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/test/',
    '<rootDir>/src/internal/result.ts'
  ],
  preset: 'ts-jest',
  testEnvironment: 'node'
}
