/**
 * React Native UI tests (components, screens, store wiring that needs a renderer). Pure logic stays
 * on Vitest (`*.test.ts`); Jest only picks up `*.test.tsx`. See docs/engineering/testing.md.
 */
const path = require('node:path');

/** Resolve `request` the way `fromPackage` (itself a dependency of `parent`) would. */
function resolveFrom(parent, fromPackage, request) {
  const parentDir = path.dirname(require.resolve(`${parent}/package.json`));
  const fromDir = path.dirname(require.resolve(`${fromPackage}/package.json`, { paths: [parentDir] }));
  return require.resolve(request, { paths: [fromDir] });
}

module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  // After env so the setup can register the console guard's afterEach.
  setupFilesAfterEnv: ['<rootDir>/src/test/ui/setup.ts'],
  // Jest's own file crawler: no dependence on the local watchman daemon (whose recrawl warnings
  // otherwise land in the test output). CI has no watchman either.
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Load the TS source, as Metro does via the package's "react-native" field. The prebuilt
    // lib/commonjs uses the classic createElement transform, which makes React warn about an
    // outdated JSX transform.
    '^react-native-draggable-flatlist$': '<rootDir>/node_modules/react-native-draggable-flatlist/src/index.tsx',
    // expo's URL polyfill (whatwg-url-without-unicode) requires `punycode` and depends on the npm
    // package; Node resolves the deprecated core module instead (DEP0040). Metro uses the package.
    '^punycode$': resolveFrom('expo', 'whatwg-url-without-unicode', 'punycode/'),
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-body-highlighter|react-native-draggable-flatlist|react-native-reanimated|react-native-worklets|@muscleos/.*))',
  ],
};
