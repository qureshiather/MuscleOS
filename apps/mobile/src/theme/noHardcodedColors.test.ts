import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Lint-style guard: screens and components must take colours from
 * `useTheme().colors` (see src/theme/palette.ts), never hard-coded literals.
 */

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN_DIRS = ['app', 'src/components'];

/** Quoted hex (`'#fff'`, `"#0F172A"`) or any rgb/rgba/hsl/hsla() call. */
const COLOR_LITERAL = /['"`]#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

/**
 * Explicit exceptions, keyed by path relative to apps/mobile. Each entry is the
 * exact list of literals allowed in that file.
 */
const ALLOWLIST: Record<string, string[]> = {
  // Decorative confetti particle colours: a fixed multicolour set, not a themed UI role.
  'src/components/WorkoutConfetti.tsx': [
    "'#22c55e",
    "'#16a34a",
    "'#4ade80",
    "'#fbbf24",
    "'#38bdf8",
    "'#f472b6",
    "'#a78bfa",
    "'#fb923c",
  ],
};

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function findColorLiterals(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const dir of SCAN_DIRS) {
    for (const file of listSourceFiles(path.join(mobileRoot, dir))) {
      const rel = path.relative(mobileRoot, file).split(path.sep).join('/');
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const match of line.matchAll(COLOR_LITERAL)) {
          const hits = found[rel] ?? [];
          hits.push(`${match[0]}@${i + 1}`);
          found[rel] = hits;
        }
      });
    }
  }
  return found;
}

describe('no hard-coded colours in screens/components', () => {
  it('scans a non-trivial number of files', () => {
    const count = SCAN_DIRS.flatMap((d) => listSourceFiles(path.join(mobileRoot, d))).length;
    expect(count).toBeGreaterThan(20);
  });

  it('only contains allowlisted colour literals', () => {
    const violations: string[] = [];
    for (const [file, hits] of Object.entries(findColorLiterals())) {
      const allowed = ALLOWLIST[file] ?? [];
      for (const hit of hits) {
        const literal = hit.slice(0, hit.lastIndexOf('@'));
        if (!allowed.includes(literal)) violations.push(`${file}:${hit.slice(hit.lastIndexOf('@') + 1)} ${literal}`);
      }
    }
    expect(violations, 'Use useTheme().colors tokens (src/theme/palette.ts) instead').toEqual([]);
  });

  it('catches the patterns it is meant to', () => {
    const sample = `color: '#fff', bg: "rgba(255,255,255,0.2)", s: '#0f172a', ok: colors.primaryOn // MUS #123`;
    expect(sample.match(COLOR_LITERAL)).toEqual(["'#fff", 'rgba(', "'#0f172a"]);
  });
});
