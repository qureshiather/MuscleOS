import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Equipment, ExerciseCategory } from '@muscleos/types';
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

describe('catalog equipment and type', () => {
  const typeByEquipment: Record<Equipment, ExerciseCategory> = {
    barbell: 'free_weight',
    dumbbell: 'free_weight',
    kettlebell: 'free_weight',
    ez_bar: 'free_weight',
    other: 'free_weight',
    machine: 'machine',
    cable: 'cable',
    band: 'cable',
    bodyweight: 'bodyweight',
  };
  const typeExceptions = new Set(['banded-muscle-up', 'kneeling-ab-wheel-roll-out', 'leg-curl-on-ball']);

  it('lists exactly one primary equipment per row', () => {
    expect(CATALOG_SEED.filter((e) => e.equipment.length !== 1).map((e) => e.id)).toEqual([]);
  });

  it('derives the library type from the equipment', () => {
    const offenders = CATALOG_SEED.filter(
      (e) => !typeExceptions.has(e.id) && e.category !== typeByEquipment[e.equipment[0]]
    ).map((e) => `${e.id}: ${e.equipment[0]} → ${e.category}`);
    expect(offenders).toEqual([]);
  });

  it('agrees with the equipment named in the exercise', () => {
    const named: [RegExp, Equipment][] = [
      [/\bsmith machine\b/i, 'machine'],
      [/^machine\b|\bmachine$/i, 'machine'],
      [/\bcable\b|pulldown|pushdown/i, 'cable'],
      [/\bdumbbells?\b/i, 'dumbbell'],
      [/\bkettlebell\b/i, 'kettlebell'],
      [/\bez bar\b|^ez curl$/i, 'ez_bar'],
      [/\bbarbell\b|landmine|^t-bar/i, 'barbell'],
      [/\bleg (curl|extension|press)\b/i, 'machine'],
    ];
    const offenders = CATALOG_SEED.flatMap((e) => {
      if (/\bon ball\b|\bbodyweight\b/i.test(e.name)) return [];
      const hit = named.find(([re]) => re.test(e.name));
      return hit && hit[1] !== e.equipment[0] ? [`${e.name}: ${e.equipment[0]} (expected ${hit[1]})`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
