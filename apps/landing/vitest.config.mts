import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same source alias as tsconfig.json: the landing reads shared labels from the types package
    // source, so it never depends on that package's build output.
    alias: {
      '@muscleos/types': fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url)),
    },
  },
});
