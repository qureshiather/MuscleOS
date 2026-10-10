#!/usr/bin/env node
/**
 * Upload rendered exercise demo clips from .exercise-demos/ to Vercel Blob, where the website
 * serves them (exercise-demos/<file> in the store). Clips are kept out of git (MUS-114).
 *
 * Needs the store's credentials in apps/landing/.env.local: run `npx vercel env pull` in
 * apps/landing (VERCEL_PUBLIC_EXERCISE_DEMO_BLOB_STORE_ID + VERCEL_OIDC_TOKEN, development enabled
 * on the store connection), or set BLOB_READ_WRITE_TOKEN.
 *
 * Usage:
 *   node scripts/upload-exercise-demos.mjs            # every clip in .exercise-demos/
 *   node scripts/upload-exercise-demos.mjs squat ...  # just these exercises
 *   ... --allow-writes=N  # required for batches over 200 files (see blob-write-guard.mjs)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';
import { config } from 'dotenv';
import { allowedWrites, writeGuardError } from './blob-write-guard.mjs';

const LANDING = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL_DIR = join(LANDING, '.exercise-demos');
const PREFIX = 'exercise-demos';
const JOBS = 8;

const CONTENT_TYPES = { '.mp4': 'video/mp4', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8' };

export async function uploadDemos(ids = [], argv = process.argv) {
  config({ path: join(LANDING, '.env.local'), quiet: true });
  const storeId = process.env.VERCEL_PUBLIC_EXERCISE_DEMO_BLOB_STORE_ID;
  const files = readdirSync(LOCAL_DIR).filter((f) => {
    if (!CONTENT_TYPES[extname(f)]) return false;
    if (!ids.length) return true;
    return f === 'LICENSE.txt' || ids.some((id) => f.startsWith(`${id}-dark.`) || f.startsWith(`${id}-light.`));
  });
  const refused = writeGuardError(files.length, allowedWrites(argv));
  if (refused) throw new Error(refused);
  let next = 0;
  let base;
  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      const blob = await put(`${PREFIX}/${file}`, readFileSync(join(LOCAL_DIR, file)), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: CONTENT_TYPES[extname(file)],
        cacheControlMaxAge: 60 * 60 * 24, // a re-render reaches viewers within a day
        ...(storeId ? { storeId } : {}),
      });
      base ??= blob.url.slice(0, blob.url.indexOf(`/${PREFIX}/`));
    }
  }
  await Promise.all(Array.from({ length: JOBS }, worker));
  console.log(`Uploaded ${files.length} files to ${base}/${PREFIX}/`);
  // The website builds clip URLs from this (public store URL, not a secret).
  writeFileSync(join(LANDING, 'app/data/exerciseDemoStore.json'), `${JSON.stringify({ baseUrl: `${base}/${PREFIX}` }, null, 2)}\n`);
  return base;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await uploadDemos(process.argv.slice(2).filter((a) => !a.startsWith('--')));
}
