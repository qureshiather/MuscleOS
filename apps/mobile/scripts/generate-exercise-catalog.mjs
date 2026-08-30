#!/usr/bin/env node
/**
 * Generate catalog seed TS + SQL from the StrengthLog-sourced exercises.ts.
 * Does not copy instructions or media URLs.
 *
 * Usage: node scripts/generate-exercise-catalog.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
const SRC_PATH = join(__dirname, '../src/data/exercises.ts');
const TS_OUT = join(__dirname, '../src/data/catalogSeed.ts');
const SQL_OUT = join(ROOT, 'supabase/migrations/20260830020000_catalog_exercises_seed.sql');

const SEED_UPDATED_AT = '2026-08-30T00:00:00.000Z';

const UNPUBLISHED = new Set([
  'powerlifting-exercises',
  'rowing-machine',
  'stationary-bike',
]);

/** Explicit category corrections (id → category). */
const CATEGORY_OVERRIDE = {
  'hang-clean': 'free_weight',
  'hang-power-clean': 'free_weight',
  'hang-power-snatch': 'free_weight',
  'hang-snatch': 'free_weight',
  'landmine-hack-squat': 'free_weight',
  't-bar-row': 'free_weight',
  'band-assisted-bench-press': 'free_weight',
  'hip-abduction-against-band': 'free_weight',
  'hip-adduction-against-band': 'free_weight',
  'standing-hip-abduction-against-band': 'free_weight',
  'face-pull': 'free_weight',
  'bayesian-curl': 'cable',
  'pallof-press': 'cable',
  'pendulum-squat': 'machine',
  'calf-raise': 'machine',
  'back-extension': 'machine',
  'glute-ham-raise': 'machine',
  'bodyweight-leg-curl': 'bodyweight',
  'leg-curl-on-ball': 'bodyweight',
  'chest-to-bar': 'bodyweight',
  'dead-bugs': 'bodyweight',
  'hollow-hold': 'bodyweight',
  'dragon-flag': 'bodyweight',
  'lying-leg-raise': 'bodyweight',
  'lying-windshield-wiper': 'bodyweight',
  'lying-windshield-wiper-with-bent-knees': 'bodyweight',
  'glute-bridge': 'bodyweight',
  'frog-pumps': 'bodyweight',
  'one-legged-glute-bridge': 'bodyweight',
  'pistol-squat': 'bodyweight',
  'inverted-row': 'bodyweight',
  'inverted-row-with-underhand-grip': 'bodyweight',
  'box-jump': 'bodyweight',
  'depth-jump': 'bodyweight',
  'lateral-bound': 'bodyweight',
  'jump-squat': 'bodyweight',
  'clamshells': 'bodyweight',
  'donkey-kicks': 'bodyweight',
  'heel-raise': 'bodyweight',
  'kneeling-ab-wheel-roll-out': 'bodyweight',
  'tibialis-raise': 'bodyweight',
  'prisoner-get-up': 'bodyweight',
  'floor-back-extension': 'bodyweight',
  'assisted-chin-up': 'machine',
  'assisted-dips': 'machine',
  'assisted-pull-up': 'machine',
};

function classify({ id, name, equipment }) {
  if (CATEGORY_OVERRIDE[id]) return CATEGORY_OVERRIDE[id];

  const eq = new Set(equipment);
  const n = `${id} ${name}`.toLowerCase();

  const isBarbellLoad =
    eq.has('barbell') ||
    eq.has('dumbbell') ||
    eq.has('kettlebell') ||
    eq.has('ez_bar') ||
    /barbell|dumbbell|kettlebell|ez.bar|trap.bar|landmine/.test(n);

  if (
    eq.has('cable') ||
    (/cable|lat-pulldown|lat pulldown|tricep-pushdown|pushdown|seated-row|wood.chop|pallof|bayesian/.test(
      n
    ) &&
      !/smith|barbell|dumbbell|banded|resistance.band/.test(n) &&
      !eq.has('barbell') &&
      !eq.has('dumbbell'))
  ) {
    if (!/smith/.test(n) && !eq.has('barbell') && !eq.has('dumbbell')) {
      return 'cable';
    }
  }

  if (
    eq.has('machine') ||
    (/smith|leg-press|hack-squat|pec-deck|assisted-|captain|hyperextension|reverse-hyper|glute-kickback-in-machine|glute-push-down|leg-extension|hip-abductor|hip-adductor|hip-thrust-machine|tricep-press|seated-calf|in-leg-press|belt-squat|pendulum|machine/.test(
      n
    ) &&
      !isBarbellLoad &&
      !eq.has('cable') &&
      !eq.has('band'))
  ) {
    return 'machine';
  }

  if (
    eq.has('bodyweight') ||
    (/push-up|pull-up|chin-up|chinup|air-squat|plank|crunch|sit-up|muscle-up|bar-hang|wall-walk|superman|fire-hydrant|bodyweight|body.weight|nordic|scap-pull|towel-pull|towel-row|chair-squat|bicycle|mountain|l-sit|hanging-/.test(
      n
    ) &&
      !isBarbellLoad &&
      !eq.has('cable') &&
      !eq.has('machine'))
  ) {
    if (/assisted/.test(n)) return 'machine';
    return 'bodyweight';
  }

  return 'free_weight';
}

function parseSource(src) {
  const items = [];
  const re =
    /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*muscles:\s*\[([^\]]*)\],\s*equipment:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(src))) {
    items.push({
      id: m[1],
      name: m[2],
      muscles: [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]),
      equipment: [...m[4].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    });
  }

  const aliasesByTarget = {};
  const aliasBlock = src.slice(src.indexOf('export const EXERCISE_SLUG_ALIASES'));
  const aliasRe = /'([^']+)':\s*'([^']+)'/g;
  while ((m = aliasRe.exec(aliasBlock))) {
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
  };
});

const counts = { free_weight: 0, machine: 0, cable: 0, bodyweight: 0 };
for (const e of catalog) counts[e.category]++;

const tsLines = [
  `import type { Exercise } from '@muscleos/types';`,
  ``,
  `/** Bundled catalog floor. Same rows as the SQL seed. Generated — do not edit by hand. */`,
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
  tsLines.push(`  { ${parts.join(', ')} },`);
}

tsLines.push(`];`, ``);

const sqlRows = catalog.map((e) => {
  return `  (${sqlString(e.id)}, ${sqlString(e.name)}, NULL, ${sqlString(e.category)}, ${sqlTextArray(e.muscles)}, ${sqlTextArray(e.equipment)}, ${sqlTextArray(e.aliases)}, 'weight_reps', ${e.isPublished}, timestamptz '${SEED_UPDATED_AT}')`;
});

const sql = `-- Generated catalog seed. Instructions left null until reviewed.
-- Do not edit by hand; regenerate with apps/mobile/scripts/generate-exercise-catalog.mjs

insert into public.catalog_exercises (
  id, name, instructions, category, muscles, equipment, aliases, tracking_type, is_published, updated_at
) values
${sqlRows.join(',\n')}
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  muscles = excluded.muscles,
  equipment = excluded.equipment,
  aliases = excluded.aliases,
  tracking_type = excluded.tracking_type,
  is_published = excluded.is_published,
  updated_at = excluded.updated_at
  -- instructions are not overwritten so reviewed copy on the server is kept
  where public.catalog_exercises.updated_at <= excluded.updated_at;
`;

mkdirSync(dirname(SQL_OUT), { recursive: true });
writeFileSync(TS_OUT, tsLines.join('\n'));
writeFileSync(SQL_OUT, sql);

console.log(`Wrote ${catalog.length} exercises`);
console.log(counts);
console.log(`unpublished: ${catalog.filter((e) => !e.isPublished).map((e) => e.id).join(', ')}`);
console.log(`TS: ${TS_OUT}`);
console.log(`SQL: ${SQL_OUT}`);
