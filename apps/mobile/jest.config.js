/**
 * React Native UI tests (components, screens, store wiring that needs a renderer). Pure logic stays
 * on Vitest (`*.test.ts`); Jest only picks up `*.test.tsx`. See docs/engineering/testing.md.
 */
module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFiles: ['<rootDir>/src/test/ui/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-body-highlighter|react-native-draggable-flatlist|react-native-reanimated|react-native-worklets|@muscleos/.*))',
  ],
};
