import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Node-based test harness stand-ins for native modules. See src/test/mocks/*.
      '@react-native-async-storage/async-storage': path.resolve(
        root,
        'src/test/mocks/asyncStorage.ts'
      ),
      'react-native': path.resolve(root, 'src/test/mocks/reactNative.ts'),
      '@': path.resolve(root, 'src'),
    },
  },
});
