module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
  },
  forceExit: true,
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.bun/|(?:(?:jest-)?react-native|@react-native(?:-community)?|@react-navigation|react-native-.*|@op-engineering|@powersync|@noble|uuid|better-auth|@better-fetch|@lofipix|@tanstack|@bam\\.tech)/))',
  ],
};
