module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  forceExit: true,
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.bun/|(?:(?:jest-)?react-native|@react-native(?:-community)?|@react-navigation|react-native-.*|@op-engineering|@electric-sql|@noble|uuid|better-auth|@better-fetch|@lofipix|@tanstack|@bam\\.tech)/))',
  ],
};
