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

/** docs/features/exercise-library.md#muscle-tags — the conventions from the MUS-171/172 audit. */
describe('catalog muscle tags', () => {
  const named = (re: RegExp) => EXERCISES.filter((e) => re.test(e.name));
  const ids = (rows: typeof EXERCISES) => rows.map((e) => e.id);

  it('tags shin work tibialis, not calves', () => {
    const shin = named(/tibialis|heel walk/i);
    expect(shin.length).toBeGreaterThanOrEqual(4);
    expect(ids(shin.filter((e) => e.muscles[0] !== 'tibialis' || e.muscles.includes('calves')))).toEqual([]);
  });

  it('tags neck work neck, not only traps', () => {
    const neck = named(/\bneck (curl|extension|bridge)/i);
    expect(neck).toHaveLength(4);
    expect(ids(neck.filter((e) => e.muscles[0] !== 'neck'))).toEqual([]);
  });

  it('tags rhomboids on every row and rear-delt pull', () => {
    const pulls = named(/\brow\b|face pull|pull-apart|reverse .*fl(y|ies)/i).filter(
      (e) => !/upright|monkey|rowing machine/i.test(e.name)
    );
    expect(pulls.length).toBeGreaterThan(25);
    expect(ids(pulls.filter((e) => !e.muscles.includes('rhomboids')))).toEqual([]);
  });

  it('leaves calves off squats, except jumps', () => {
    const squats = named(/squat/i).filter((e) => !/jump|jerk/i.test(e.name));
    expect(ids(squats.filter((e) => e.muscles.includes('calves')))).toEqual([]);
  });

  it('adds adductors to wide-stance squats, Cossack squats and side lunges', () => {
    const wide = named(/(sumo|wide[- ]stance).*squat|cossack|(side|lateral) lunge/i);
    expect(wide.length).toBeGreaterThanOrEqual(3);
    expect(ids(wide.filter((e) => !e.muscles.includes('adductors')))).toEqual([]);
  });

  it('tags hip abduction glutes (there is no abductor muscle)', () => {
    const abduction = named(/hip abduct/i);
    expect(abduction.length).toBeGreaterThanOrEqual(3);
    expect(ids(abduction.filter((e) => !e.muscles.includes('glutes')))).toEqual([]);
  });

  it('tags external rotations rear delts and internal rotations front delts', () => {
    const external = named(/external .*rotation/i);
    const internal = named(/internal .*rotation/i);
    expect(external.length).toBeGreaterThanOrEqual(3);
    expect(internal.length).toBeGreaterThanOrEqual(3);
    expect(ids(external.filter((e) => e.muscles[0] !== 'rear_delts'))).toEqual([]);
    expect(ids(internal.filter((e) => e.muscles[0] !== 'front_delts'))).toEqual([]);
  });

  it('leads straight-leg hinges with the hamstrings', () => {
    const hinges = named(/^(dumbbell )?romanian deadlift|stiff-leg|good morning/i);
    expect(hinges.length).toBeGreaterThanOrEqual(4);
    expect(ids(hinges.filter((e) => e.muscles[0] !== 'hamstrings'))).toEqual([]);
  });

  it('keeps tags to the muscles a lift really loads', () => {
    expect(ids(EXERCISES.filter((e) => e.muscles.length > 7))).toEqual([]);
  });
});
