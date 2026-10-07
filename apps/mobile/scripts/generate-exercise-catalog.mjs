#!/usr/bin/env node
/**
 * Generate the bundled catalog seed (src/data/catalogSeed.ts) from src/data/exercises.ts (the
 * hand-maintained source). The seed carries instructions so a fresh install has them without a
 * delta pull.
 *
 * It never writes an already-applied migration. Server-side catalog changes ship as new
 * migrations: instruction copy through --instructions-migration, other field changes by hand.
 *
 * Usage:
 *   node scripts/generate-exercise-catalog.mjs
 *   node scripts/generate-exercise-catalog.mjs --instructions-migration=<timestamp>_<name>
 *     also writes supabase/migrations/<timestamp>_<name>.sql, which sets every catalog
 *     row's instructions from exercises.ts and bumps updated_at so clients pull it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
const SRC_PATH = join(__dirname, '../src/data/exercises.ts');
const TS_OUT = join(__dirname, '../src/data/catalogSeed.ts');
// The landing site's exercise pages (muscleos.app/exercises) read the published rows from here.
const LANDING_OUT = join(ROOT, 'apps/landing/app/data/exerciseCatalog.json');

const SEED_UPDATED_AT = '2026-10-02T00:00:00.000Z';

const instructionsArg = process.argv.find((a) => a.startsWith('--instructions-migration='));
const INSTRUCTIONS_MIGRATION = instructionsArg ? instructionsArg.split('=')[1] : null;
if (INSTRUCTIONS_MIGRATION !== null && !/^\d{14}_[a-z0-9_]+$/.test(INSTRUCTIONS_MIGRATION)) {
  console.error('--instructions-migration must look like 20260930010000_catalog_exercise_instructions');
  process.exit(1);
}

const UNPUBLISHED = new Set([
  'powerlifting-exercises',
  'rowing-machine',
  'stationary-bike',
]);

/**
 * Library Type follows the row's (single, primary) equipment. Bands count as Cable: both are
 * anchored, variable-resistance pulls.
 */
const CATEGORY_BY_EQUIPMENT = {
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

/** Rows whose Type differs from their equipment's (id → category). Keep this list short. */
const CATEGORY_OVERRIDE = {
  // The band assists a bodyweight movement rather than providing resistance.
  'banded-muscle-up': 'bodyweight',
  // Ab wheel / stability ball are props; the load is your body.
  'kneeling-ab-wheel-roll-out': 'bodyweight',
  'leg-curl-on-ball': 'bodyweight',
};

function classify({ id, equipment }) {
  if (CATEGORY_OVERRIDE[id]) return CATEGORY_OVERRIDE[id];
  if (equipment.length !== 1 || !CATEGORY_BY_EQUIPMENT[equipment[0]]) {
    throw new Error(`${id}: catalog rows list exactly one primary equipment, got [${equipment}]`);
  }
  return CATEGORY_BY_EQUIPMENT[equipment[0]];
}

function parseSource(src) {
  const items = [];
  const re =
    /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*muscles:\s*\[([^\]]*)\],\s*equipment:\s*\[([^\]]*)\](?:,\s*instructions:\s*("(?:[^"\\]|\\.)*"))?/g;
  for (const m of src.matchAll(re)) {
    items.push({
      id: m[1],
      name: m[2],
      muscles: [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]),
      equipment: [...m[4].matchAll(/'([^']+)'/g)].map((x) => x[1]),
      instructions: m[5] ? JSON.parse(m[5]) : null,
    });
  }

  const aliasesByTarget = {};
  const aliasBlock = src.slice(src.indexOf('export const EXERCISE_SLUG_ALIASES'));
  const aliasRe = /'([^']+)':\s*'([^']+)'/g;
  for (const m of aliasBlock.matchAll(aliasRe)) {
    const [, alias, target] = m;
    if (!aliasesByTarget[target]) aliasesByTarget[target] = [];
    if (!aliasesByTarget[target].includes(alias)) aliasesByTarget[target].push(alias);
  }

  return { items, aliasesByTarget };
}

function tsString(s) {
  return JSON.stringify(s);
}

function sqlString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (arr.length === 0) return `'{}'::text[]`;
  return `ARRAY[${arr.map(sqlString).join(', ')}]::text[]`;
}

const src = readFileSync(SRC_PATH, 'utf8');
const { items, aliasesByTarget } = parseSource(src);

const catalog = items.map((it) => {
  const aliases = aliasesByTarget[it.id] ?? [];
  return {
    id: it.id,
    name: it.name,
    muscles: it.muscles,
    equipment: it.equipment,
    category: classify(it),
    aliases,
    isPublished: !UNPUBLISHED.has(it.id),
    instructions: it.instructions,
  };
});

const counts = { free_weight: 0, machine: 0, cable: 0, bodyweight: 0 };
for (const e of catalog) counts[e.category]++;

const tsLines = [
  `import type { Exercise } from '@muscleos/types';`,
  ``,
  `/** Bundled catalog floor, instructions included. Generated — do not edit by hand. */`,
  `export const CATALOG_SEED_UPDATED_AT = ${tsString(SEED_UPDATED_AT)};`,
  ``,
  `export const CATALOG_SEED: Exercise[] = [`,
];

for (const e of catalog) {
  const parts = [
    `id: ${tsString(e.id)}`,
    `name: ${tsString(e.name)}`,
    `muscles: [${e.muscles.map(tsString).join(', ')}]`,
    `equipment: [${e.equipment.map(tsString).join(', ')}]`,
    `category: ${tsString(e.category)}`,
  ];
  if (e.aliases.length) parts.push(`aliases: [${e.aliases.map(tsString).join(', ')}]`);
  if (!e.isPublished) parts.push(`isPublished: false`);
  if (e.instructions) parts.push(`instructions: ${tsString(e.instructions)}`);
  tsLines.push(`  { ${parts.join(', ')} },`);
}

tsLines.push(`];`, ``);

writeFileSync(TS_OUT, tsLines.join('\n'));

const landingRows = catalog
  .filter((e) => e.isPublished)
  .map(({ id, name, muscles, equipment, category, instructions }) => ({ id, name, muscles, equipment, category, instructions }));
writeFileSync(LANDING_OUT, `[\n${landingRows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`);

if (INSTRUCTIONS_MIGRATION) {
  const missing = catalog.filter((e) => !e.instructions).map((e) => e.id);
  if (missing.length) {
    console.error(`Missing instructions: ${missing.join(', ')}`);
    process.exit(1);
  }
  const rows = catalog.map((e) => `  (${sqlString(e.id)}, ${sqlString(e.instructions)})`);
  const instructionsSql = `-- Catalog instruction copy from apps/mobile/src/data/exercises.ts.
-- Generated by apps/mobile/scripts/generate-exercise-catalog.mjs --instructions-migration=${INSTRUCTIONS_MIGRATION}
-- Bumps updated_at to now() only on rows whose text changes, so existing clients pull the new
-- copy via the catalog delta (updated_at > watermark) and re-running is a no-op.

update public.catalog_exercises as c
set
  instructions = v.instructions,
  updated_at = now()
from (values
${rows.join(',\n')}
) as v(id, instructions)
where c.id = v.id
  and c.instructions is distinct from v.instructions;
`;
  const instructionsOut = join(ROOT, `supabase/migrations/${INSTRUCTIONS_MIGRATION}.sql`);
  if (existsSync(instructionsOut)) {
    console.error(`${instructionsOut} already exists; applied migrations are never rewritten`);
    process.exit(1);
  }
  writeFileSync(instructionsOut, instructionsSql);
  console.log(`Instructions SQL: ${instructionsOut}`);
}

console.log(`Wrote ${catalog.length} exercises`);
console.log(counts);
console.log(`unpublished: ${catalog.filter((e) => !e.isPublished).map((e) => e.id).join(', ')}`);
console.log(`TS: ${TS_OUT}`);
console.log(`Landing: ${LANDING_OUT}`);
