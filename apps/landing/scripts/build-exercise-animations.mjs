#!/usr/bin/env node
/**
 * Render exercise animations with headless Blender and encode them for the landing site.
 *
 * Output (committed, served statically, never bundled into the mobile app):
 *   public/exercise-demos/<id>-<theme>.mp4    H.264 loop, muted, faststart
 *   public/exercise-demos/<id>-<theme>.webp   poster frame
 *   app/data/exerciseDemos.json          ids with a clip, for the landing exercise pages
 *
 * Usage:
 *   node scripts/build-exercise-animations.mjs                 # every animated exercise
 *   node scripts/build-exercise-animations.mjs --missing       # only those without clips yet
 *   node scripts/build-exercise-animations.mjs squat deadlift  # just these
 *   node scripts/build-exercise-animations.mjs --check [ids…]  # contact sheet of key frames
 *   node scripts/build-exercise-animations.mjs --manifest      # only rewrite the id list
 *   BLENDER=/path/to/blender JOBS=4 node scripts/build-exercise-animations.mjs
 *
 * Every exercise shares one mannequin, rig and equipment set (scripts/exercise-animations/),
 * so after changing any of them run --check to see the effect on all exercises at once.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const LANDING = join(__dirname, '..');
const MOBILE_DATA = join(LANDING, '../mobile/src/data');
const PIPELINE = join(__dirname, 'exercise-animations');
const OUT = join(LANDING, 'public/exercise-demos');

const BLENDER = process.env.BLENDER ?? 'blender';
const JOBS = Number(process.env.JOBS ?? 3);
const SIZE = 640;
const FRAMES = 72;
const FPS = 24;
const THEMES = ['dark', 'light'];
const BLENDER_ARGS = ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(PIPELINE, 'render_exercise.py')];

/** Every exercise with choreography (scripts/exercise-animations/catalog.py). */
async function specIds() {
  const { stdout } = await run(BLENDER, [...BLENDER_ARGS, '--', '--list'], { maxBuffer: 16 * 1024 * 1024 });
  const line = stdout.split('\n').find((l) => l.startsWith('SPECS '));
  if (!line) throw new Error('could not list exercise specs');
  return line.slice(6).trim().split(/\s+/);
}

function musclesById() {
  const src = readFileSync(join(MOBILE_DATA, 'exercises.ts'), 'utf8');
  const map = new Map();
  for (const m of src.matchAll(/\{\s*id:\s*"([^"]+)",\s*name:\s*"[^"]+",\s*muscles:\s*\[([^\]]*)\]/g)) {
    map.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  }
  return map;
}

const CHECK_FRAMES = [0, Math.round(FRAMES * 0.3), Math.round(FRAMES * 0.55)];
const CHECK_OUT = join(PIPELINE, '.cache', 'check.png');

/** Start, mid-rep and far-end stills for one exercise, tiled into a row. */
async function checkOne(id, muscles, rowsDir) {
  const frames = mkdtempSync(join(tmpdir(), `muscleos-check-${id}-`));
  try {
    await run(BLENDER, [...BLENDER_ARGS, '--', '--id', id, '--theme', 'dark', '--muscles', muscles.join(','),
      '--out', frames, '--size', '320', '--frames', String(FRAMES), '--stills', CHECK_FRAMES.join(',')],
      { maxBuffer: 64 * 1024 * 1024 });
    const inputs = CHECK_FRAMES.flatMap((f) => ['-i', join(frames, `${String(f).padStart(4, '0')}.png`)]);
    await run('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex',
      `hstack=inputs=${CHECK_FRAMES.length},drawtext=text='${id}':x=10:y=10:fontsize=18:fontcolor=white`,
      join(rowsDir, `${id}.png`)]);
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}

async function renderOne(id, theme, muscles) {
  const frames = mkdtempSync(join(tmpdir(), `muscleos-${id}-${theme}-`));
  try {
    await run(
      BLENDER,
      [
        ...BLENDER_ARGS,
        '--',
        '--id',
        id,
        '--theme',
        theme,
        '--muscles',
        muscles.join(','),
        '--out',
        frames,
        '--size',
        String(SIZE),
        '--frames',
        String(FRAMES),
        '--fps',
        String(FPS),
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const mp4 = join(OUT, `${id}-${theme}.mp4`);
    await run('ffmpeg', [
      '-loglevel', 'error', '-y',
      '-framerate', String(FPS),
      '-i', join(frames, '%04d.png'),
      '-vf', 'scale=480:480:flags=lanczos',
      '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '24', '-tune', 'animation',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
      mp4,
    ]);
    // Poster: the far end of the rep (u = 1 sits around 55% of the loop).
    const poster = String(Math.round(FRAMES * 0.55)).padStart(4, '0');
    await run('ffmpeg', [
      '-loglevel', 'error', '-y',
      '-i', join(frames, `${poster}.png`),
      '-vf', 'scale=480:480:flags=lanczos',
      '-c:v', 'libwebp', '-quality', '78',
      join(OUT, `${id}-${theme}.webp`),
    ]);
    return statSync(mp4).size;
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}

/** Exercises with every theme's clip and poster on disk. */
function renderedIds() {
  const ids = new Set(readdirSync(OUT).filter((f) => f.endsWith('.mp4')).map((f) => f.replace(/-(dark|light)\.mp4$/, '')));
  return [...ids]
    .filter((id) => THEMES.every((t) => existsSync(join(OUT, `${id}-${t}.mp4`)) && existsSync(join(OUT, `${id}-${t}.webp`))))
    .sort();
}

function writeManifests() {
  const ids = renderedIds();
  writeFileSync(join(LANDING, 'app/data/exerciseDemos.json'), `${JSON.stringify(ids, null, 2)}\n`);
  console.log(`Manifest: ${ids.length} exercises with demos`);
}

async function main() {
  if (process.argv.includes('--manifest')) {
    writeManifests();
    return;
  }
  const check = process.argv.includes('--check');
  const missing = process.argv.includes('--missing');
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let ids = requested.length ? requested : await specIds();
  if (missing) {
    const have = new Set(renderedIds());
    ids = ids.filter((id) => !have.has(id));
  }
  const muscles = musclesById();
  mkdirSync(OUT, { recursive: true });
  // Build the shared mannequin once, so parallel renders only read the cache.
  await run(BLENDER, [...BLENDER_ARGS, '--', '--build-mannequin']);

  for (const id of ids) if (!muscles.get(id)) throw new Error(`${id}: not in exercises.ts`);

  if (check) {
    const rowsDir = mkdtempSync(join(tmpdir(), 'muscleos-check-rows-'));
    let i = 0;
    const failures = [];
    await Promise.all(Array.from({ length: JOBS }, async () => {
      while (i < ids.length) {
        const id = ids[i++];
        try {
          await checkOne(id, muscles.get(id), rowsDir);
        } catch (e) {
          failures.push(id);
          console.error(`${id}: FAILED\n${e.stderr ?? e.message}`);
        }
      }
    }));
    const rows = ids.filter((id) => !failures.includes(id)).flatMap((id) => ['-i', join(rowsDir, `${id}.png`)]);
    if (rows.length > 2) {
      await run('ffmpeg', ['-loglevel', 'error', '-y', ...rows, '-filter_complex', `vstack=inputs=${rows.length / 2}`, CHECK_OUT]);
    } else if (rows.length === 2) {
      await run('ffmpeg', ['-loglevel', 'error', '-y', ...rows, CHECK_OUT]);
    }
    rmSync(rowsDir, { recursive: true, force: true });
    console.log(`Contact sheet: ${CHECK_OUT}`);
    if (failures.length) process.exit(1);
    return;
  }

  const jobs = [];
  for (const id of ids) for (const theme of THEMES) jobs.push({ id, theme, muscles: muscles.get(id) });

  let next = 0;
  let failed = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const t = Date.now();
      try {
        const bytes = await renderOne(job.id, job.theme, job.muscles);
        console.log(`${job.id} ${job.theme}: ${(bytes / 1024).toFixed(0)} KB in ${((Date.now() - t) / 1000).toFixed(0)}s`);
      } catch (e) {
        failed++;
        console.error(`${job.id} ${job.theme}: FAILED\n${e.stderr ?? e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: JOBS }, worker));
  writeManifests();
  if (failed) process.exit(1);
}

main();
