#!/usr/bin/env node
/**
 * Seed MuscleOS exercises from StrengthLog's exercise directory.
 * https://www.strengthlog.com/exercise-directory/
 *
 * Usage: node scripts/seed-exercises-from-strengthlog.mjs [--limit N] [--dry-run]
 *
 * Non-commercial use with attribution per StrengthLog's terms.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../src/data/exercises.ts');
const LIST_PATH = '/tmp/strengthlog-exercises.txt';

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

/** Slugs that are articles, not exercises */
const EXCLUDE_SLUGS = new Set([
  'top-20-bodybuilding-exercises',
  'how-many-exercises-per-muscle-group',
]);

/** Keep legacy MuscleOS IDs for templates / saved workouts */
const LEGACY_ID_BY_SLUG = {
  'incline-bench-press': 'incline-bench',
  'dumbbell-chest-fly': 'dumbbell-fly',
  'seated-dumbbell-shoulder-press': 'dumbbell-ohp',
  'dumbbell-lateral-raise': 'lateral-raise',
  'dumbbell-front-raise': 'front-raise',
  'tricep-pushdown-with-rope': 'tricep-pushdown',
  'bar-dip': 'tricep-dips',
  'barbell-lying-triceps-extension': 'skull-crusher',
  'cable-close-grip-seated-row': 'seated-row',
  'lying-leg-curl': 'leg-curl',
  'hip-abduction-machine': 'hip-abductor',
  'hip-adduction-machine': 'hip-adductor',
  'dumbbell-lunge': 'lunges',
  'standing-calf-raise': 'calf-raise',
  'barbell-hip-thrust': 'hip-thrust',
  'dumbbell-side-bend': 'side-bend',
  'chin-up': 'chinups',
  'hack-squat-machine': 'hack-squat',
  'bulgarian-split-squat': 'bulgarian-split',
  'standing-cable-chest-fly': 'cable-fly',
  'reverse-dumbbell-flyes': 'reverse-fly',
  'barbell-wrist-curl': 'wrist-curl',
  'dumbbell-wrist-extension': 'reverse-wrist-curl',
  'close-grip-bench-press': 'close-grip-bench',
  'lat-pulldown-with-pronated-grip': 'lat-pulldown',
  'barbell-upright-row': 'upright-row',
  'barbell-shrug': 'shrug',
  'barbell-preacher-curl': 'preacher-curl',
  'banded-face-pull': 'face-pull',
};

/** Fallback muscles when StrengthLog pages omit muscle lists */
const MANUAL_MUSCLES_BY_SLUG = {
  'band-external-shoulder-rotation': ['rear_delts'],
  'band-internal-shoulder-rotation': ['front_delts'],
  'cable-external-shoulder-rotation': ['rear_delts'],
  'internal-shoulder-rotations': ['front_delts'],
  'lying-dumbbell-external-shoulder-rotation': ['rear_delts'],
  'dumbbell-horizontal-internal-shoulder-rotation': ['front_delts'],
  'lying-dumbbell-internal-shoulder-rotation': ['front_delts'],
  'banded-hip-march': ['abs', 'quads'],
  'banded-muscle-up': ['lats', 'chest', 'triceps', 'biceps'],
  'bar-muscle-up': ['lats', 'chest', 'triceps', 'biceps'],
  'jumping-muscle-up': ['lats', 'chest', 'triceps', 'biceps'],
  'ring-muscle-up': ['lats', 'chest', 'triceps', 'biceps'],
  'barbell-wrist-extension': ['forearms'],
  'dumbbell-lying-triceps-extension': ['triceps'],
  'lying-triceps-extension-ez-bar': ['triceps'],
  'machine-overhead-triceps-extension': ['triceps'],
  'fire-hydrants': ['glutes'],
  'heel-walks': ['calves'],
  'hip-adduction-against-band': ['glutes'],
  'hip-adduction-machine': ['glutes'],
  'cable-machine-hip-adduction': ['glutes'],
  'dumbbell-wrist-extension': ['forearms'],
  'side-lunges-bodyweight': ['quads', 'glutes'],
  'smith-machine-lunge': ['quads', 'glutes'],
  'smith-machine-skull-crushers': ['triceps'],
  'spider-curl': ['biceps'],
  'dumbbell-horizontal-external-shoulder-rotation': ['rear_delts'],
  'standing-hip-flexor-raise': ['abs', 'quads'],
  'step-up': ['quads', 'glutes'],
  'tate-press': ['triceps'],
  'tibialis-band-pull': ['calves'],
  'tibialis-raise': ['calves'],
  'turkish-get-up': ['front_delts', 'abs', 'glutes'],
  'kettlebell-tibialis-raise': ['calves'],
  'lying-neck-curl': ['traps'],
  'lying-neck-extension': ['traps'],
  'prone-neck-bridge': ['traps'],
  'supine-neck-bridge': ['traps'],
  'resistance-band-chest-fly': ['chest'],
  'rowing-machine': ['lats', 'quads', 'hamstrings'],
  'stationary-bike': ['quads', 'hamstrings', 'calves'],
};

const MUSCLE_MAP = {
  chest: 'chest',
  pectoralis: 'chest',
  pec: 'chest',
  'front deltoid': 'front_delts',
  'front delts': 'front_delts',
  'anterior deltoid': 'front_delts',
  'lateral deltoid': 'side_delts',
  'side delts': 'side_delts',
  'middle deltoid': 'side_delts',
  'rear deltoid': 'rear_delts',
  'posterior deltoid': 'rear_delts',
  'rear delts': 'rear_delts',
  trapezius: 'traps',
  traps: 'traps',
  latissimus: 'lats',
  lats: 'lats',
  rhomboids: 'rhomboids',
  biceps: 'biceps',
  bicep: 'biceps',
  triceps: 'triceps',
  tricep: 'triceps',
  forearms: 'forearms',
  forearm: 'forearms',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  grip: 'forearms',
  abs: 'abs',
  abdominals: 'abs',
  'rectus abdominis': 'abs',
  obliques: 'obliques',
  oblique: 'obliques',
  'lower back': 'lower_back',
  'back extensors': 'lower_back',
  erector: 'lower_back',
  quadriceps: 'quads',
  quads: 'quads',
  quad: 'quads',
  hamstrings: 'hamstrings',
  hamstring: 'hamstrings',
  glutes: 'glutes',
  glute: 'glutes',
  calves: 'calves',
  calf: 'calves',
  gastrocnemius: 'calves',
  soleus: 'calves',
};

const CATEGORY_MUSCLES = {
  'Chest Exercises': ['chest'],
  'Shoulder Exercises': ['front_delts', 'side_delts'],
  'Bicep Exercises': ['biceps'],
  'Triceps Exercises': ['triceps'],
  'Leg Exercises': ['quads', 'hamstrings', 'glutes'],
  'Back Exercises': ['lats', 'rhomboids', 'lower_back'],
  'Glute Exercises': ['glutes'],
  'Ab Exercises': ['abs'],
  'Calves Exercises': ['calves'],
  'Forearm Flexors & Grip Exercises': ['forearms'],
  'Forearm Extensor Exercises': ['forearms'],
  'Neck Exercises': ['traps'],
  'Cardio Exercises & Equipment': [],
};

function mapMuscle(name) {
  const lower = name.toLowerCase().trim();
  for (const [key, id] of Object.entries(MUSCLE_MAP)) {
    if (lower.includes(key)) return id;
  }
  return null;
}

const BARBELL_SLUGS = new Set([
  'squat', 'bench-press', 'deadlift', 'overhead-press', 'barbell-row', 'barbell-curl',
  'romanian-deadlift', 'hip-thrust', 'barbell-hip-thrust', 'front-squat', 'sumo-deadlift',
  'incline-bench-press', 'decline-bench-press', 'close-grip-bench-press',
]);

function decodeHtmlEntities(text) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function inferEquipment(slug, name) {
  const text = `${slug} ${name}`.toLowerCase();
  const equipment = [];

  if (text.includes('smith machine') || slug.includes('smith-machine')) equipment.push('machine');
  if (text.includes('dumbbell') || slug.includes('dumbbell')) equipment.push('dumbbell');
  if (text.includes('kettlebell') || slug.includes('kettlebell')) equipment.push('kettlebell');
  if (text.includes('cable') || slug.includes('cable')) equipment.push('cable');
  if ((text.includes('machine') || slug.includes('machine')) && !equipment.includes('machine')) {
    equipment.push('machine');
  }
  if (text.includes('band') || slug.includes('band')) equipment.push('band');
  if (text.includes('ez bar') || text.includes('ez-bar') || slug.includes('ez-bar')) equipment.push('ez_bar');
  if (text.includes('barbell') || slug.includes('barbell') || BARBELL_SLUGS.has(slug)) {
    equipment.push('barbell');
  }
  if (text.includes('trap bar') || slug.includes('trap-bar')) equipment.push('barbell');

  const isBodyweight =
    slug.includes('push-up') ||
    slug.includes('pull-up') ||
    slug.includes('chin-up') ||
    slug.includes('dip') ||
    slug.includes('plank') ||
    slug.includes('crunch') ||
    slug.includes('sit-up') ||
    slug.includes('bodyweight') ||
    slug.includes('air-squat') ||
    (slug.includes('lunge') && !slug.includes('dumbbell') && !slug.includes('barbell') && !slug.includes('smith'));

  if (isBodyweight && !equipment.length) equipment.push('bodyweight');
  if (!equipment.length) equipment.push('other');
  return [...new Set(equipment)];
}

function parseExerciseList(html) {
  const start = html.indexOf('entry-content');
  const end = html.indexOf('Toggle', html.indexOf('Muscle Directory'));
  const section = html.slice(start, end > start ? end : start + 200000);
  const links = [...section.matchAll(/<li><a href="https:\/\/www\.strengthlog\.com\/([^/]+)\/">([^<]+)<\/a><\/li>/g)];

  const byCategory = {};
  let currentCategory = null;
  const categoryPattern = /<h3[^>]*>([^<]+)<\/h3>/g;
  const parts = section.split(/<h3[^>]*>/);
  for (const part of parts.slice(1)) {
    const catMatch = part.match(/^([^<]+)<\/h3>([\s\S]*)/);
    if (!catMatch) continue;
    const category = catMatch[1].trim();
    const block = catMatch[2];
    const items = [...block.matchAll(/<li><a href="https:\/\/www\.strengthlog\.com\/([^/]+)\/">([^<]+)<\/a><\/li>/g)];
    for (const [, slug, name] of items) {
      if (EXCLUDE_SLUGS.has(slug)) continue;
      byCategory[slug] = { slug, name: name.trim(), category };
    }
  }

  // fallback if h3 parsing missed some
  for (const [, slug, name] of links) {
    if (EXCLUDE_SLUGS.has(slug)) continue;
    if (!byCategory[slug]) {
      byCategory[slug] = { slug, name: name.trim(), category: null };
    }
  }
  return Object.values(byCategory).filter((e) => !EXCLUDE_SLUGS.has(e.slug));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MuscleOS/1.0 (exercise seed; non-commercial)' },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function parseMediaUrl(html, slug) {
  const ldMatch = html.match(/"thumbnailUrl":"(https:\\\/\\\/[^"]+)"/);
  if (ldMatch) {
    const url = ldMatch[1].replace(/\\\//g, '/');
    if (!url.includes('StrengthLog-logo') && !url.includes('Swolaf')) return url;
  }
  const slugGif = html.match(new RegExp(`https://[^"\\s]+uploads/[^"\\s]*${slug}[^"\\s]*\\.gif`, 'i'));
  if (slugGif) return slugGif[0].replace(/&amp;/g, '&').split('?')[0];
  const anyGif = html.match(/https:\/\/i\d\.wp\.com\/www\.strengthlog\.com\/wp-content\/uploads\/[^"?\s]+\.gif/);
  if (anyGif) return anyGif[0].replace(/&amp;/g, '&').split('?')[0];
  return undefined;
}

function parseExercisePage(html, meta) {
  const captionMatch = html.match(/"caption":"([^"]+)"/);
  const name = captionMatch?.[1] && captionMatch[1] !== 'StrengthLog' ? captionMatch[1] : meta.name;

  const primaryMatch = html.match(/Primary muscles worked:<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/);
  const secondaryMatch = html.match(/Secondary muscles worked:<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/);

  const extractList = (block) => {
    if (!block) return [];
    return [...block[1].matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1].trim());
  };

  const muscles = new Set();
  for (const m of [...extractList(primaryMatch), ...extractList(secondaryMatch)]) {
    const id = mapMuscle(m);
    if (id) muscles.add(id);
  }

  if (muscles.size === 0 && meta.category && CATEGORY_MUSCLES[meta.category]) {
    for (const m of CATEGORY_MUSCLES[meta.category]) muscles.add(m);
  }

  if (muscles.size === 0 && MANUAL_MUSCLES_BY_SLUG[meta.slug]) {
    for (const m of MANUAL_MUSCLES_BY_SLUG[meta.slug]) muscles.add(m);
  }

  const howMatch = html.match(/How to [^<]+<\/h2>\s*<ol[^>]*>([\s\S]*?)<\/ol>/);
  let instructions;
  if (howMatch) {
    const steps = [...howMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map((m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()))
      .filter(Boolean);
    if (steps.length) instructions = steps.join(' ');
  }

  const mediaUrl = parseMediaUrl(html, meta.slug);

  return { name: decodeHtmlEntities(name), muscles: [...muscles], instructions, mediaUrl };
}

function tsString(value) {
  return JSON.stringify(value);
}

function formatExercise(ex) {
  const parts = [
    `id: ${tsString(ex.id)}`,
    `name: ${tsString(ex.name)}`,
    `muscles: [${ex.muscles.map((m) => `'${m}'`).join(', ')}]`,
    `equipment: [${ex.equipment.map((e) => `'${e}'`).join(', ')}]`,
  ];
  if (ex.instructions) parts.push(`instructions: ${tsString(ex.instructions)}`);
  if (ex.mediaUrl) parts.push(`mediaUrl: ${tsString(ex.mediaUrl)}`);
  return `  { ${parts.join(', ')} },`;
}

async function pool(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        results[idx] = { error: err.message, meta: items[idx] };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  console.log('Fetching StrengthLog exercise directory...');
  const directoryHtml = await fetchHtml('https://www.strengthlog.com/exercise-directory/');
  let exercises = parseExerciseList(directoryHtml);
  console.log(`Found ${exercises.length} exercises in directory`);

  if (LIMIT < Infinity) exercises = exercises.slice(0, LIMIT);

  console.log(`Fetching ${exercises.length} exercise pages (concurrency 8)...`);
  const parsed = await pool(exercises, 8, async (meta) => {
    const html = await fetchHtml(`https://www.strengthlog.com/${meta.slug}/`);
    const data = parseExercisePage(html, meta);
    const id = LEGACY_ID_BY_SLUG[meta.slug] ?? meta.slug;
    const equipment = inferEquipment(meta.slug, data.name);
    process.stdout.write('.');
    return {
      id,
      slug: meta.slug,
      name: data.name,
      muscles: data.muscles.length ? data.muscles : (CATEGORY_MUSCLES[meta.category] ?? []),
      equipment,
      instructions: data.instructions,
      mediaUrl: data.mediaUrl,
      category: meta.category,
    };
  });
  console.log('\nDone fetching.');

  const errors = parsed.filter((p) => p?.error);
  if (errors.length) {
    console.warn(`Failed to parse ${errors.length} exercises:`);
    for (const e of errors.slice(0, 10)) console.warn(`  ${e.meta.slug}: ${e.error}`);
  }

  const ok = parsed.filter((p) => p && !p.error);

  // Deduplicate by id (prefer first / legacy)
  const byId = new Map();
  for (const ex of ok) {
    if (!byId.has(ex.id)) byId.set(ex.id, ex);
  }
  const final = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  const noMuscles = final.filter((e) => !e.muscles.length || e.muscles[0] === 'other');
  console.log(`Generated ${final.length} exercises (${noMuscles.length} with fallback/no muscles)`);

  const header = `import type { Exercise } from '@muscleos/types';

/**
 * Exercise catalog seeded from StrengthLog's exercise directory.
 * https://www.strengthlog.com/exercise-directory/
 * Used under their non-commercial attribution terms.
 */
`;

  const body = `export const EXERCISES: Exercise[] = [\n${final.map(formatExercise).join('\n')}\n];\n\nexport const EXERCISE_MAP = new Map(EXERCISES.map((e) => [e.id, e]));\n\n/** Legacy slug → canonical id (for old saved workouts referencing StrengthLog slugs) */\nexport const EXERCISE_SLUG_ALIASES: Record<string, string> = {\n${ok
    .filter((e) => e.id !== e.slug)
    .map((e) => `  '${e.slug}': '${e.id}',`)
    .join('\n')}\n};\n\nexport function getExercise(id: string): Exercise | undefined {\n  const resolved = EXERCISE_SLUG_ALIASES[id] ?? id;\n  return EXERCISE_MAP.get(resolved);\n}\n`;

  const output = header + body;

  if (DRY_RUN) {
    console.log('\n--- Sample (first 5) ---');
    console.log(final.slice(0, 5).map(formatExercise).join('\n'));
    console.log(`\nWould write ${final.length} exercises to ${OUT_PATH}`);
  } else {
    writeFileSync(OUT_PATH, output, 'utf8');
    console.log(`Wrote ${OUT_PATH} (${final.length} exercises)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
