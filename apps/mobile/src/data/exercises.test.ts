import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOG_SEED } from './catalogSeed';
import { EXERCISES } from './exercises';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../../../supabase/migrations');

describe('catalog source', () => {
  it('covers exactly the bundled seed ids', () => {
    expect(EXERCISES.map((e) => e.id).sort()).toEqual(CATALOG_SEED.map((e) => e.id).sort());
  });

  it('gives every exercise non-empty instructions', () => {
    const missing = EXERCISES.filter((e) => !e.instructions?.trim()).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('carries no third-party media or attribution', () => {
    const offenders = EXERCISES.filter((e) =>
      /strengthlog|https?:\/\//i.test(JSON.stringify(e))
    ).map((e) => e.id);
    expect(offenders).toEqual([]);
    expect(EXERCISES.some((e) => 'mediaUrl' in e)).toBe(false);
  });

  it('ships the current instruction copy in a catalog migration', () => {
    const sql = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n');
    const missing = EXERCISES.filter(
      (e) => !sql.includes(`('${e.id}', '${e.instructions.replace(/'/g, "''")}')`)
    ).map((e) => e.id);
    expect(missing).toEqual([]);
  });
});
