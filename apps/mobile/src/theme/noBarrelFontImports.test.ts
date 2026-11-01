import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Lint-style guard: importing `@expo/vector-icons` or an `@expo-google-fonts/*` package from its
 * root makes Metro bundle every icon font or every font weight (~5 MB) into the app. Import the
 * one family or weight instead: `@expo/vector-icons/Ionicons`, `@expo-google-fonts/dm-sans/500Medium`.
 */

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN_DIRS = ['app', 'src'];

const BARREL_IMPORT = /from\s+['"](@expo\/vector-icons|@expo-google-fonts\/[\w-]+)['"]/g;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'test') out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('font and icon imports', () => {
  it('never import a whole icon set or font family', () => {
    const found: Record<string, string[]> = {};
    for (const dir of SCAN_DIRS) {
      for (const file of listSourceFiles(path.join(mobileRoot, dir))) {
        const matches = [...readFileSync(file, 'utf8').matchAll(BARREL_IMPORT)].map((m) => m[1]);
        if (matches.length > 0) found[path.relative(mobileRoot, file)] = matches;
      }
    }
    expect(found).toEqual({});
  });
});
