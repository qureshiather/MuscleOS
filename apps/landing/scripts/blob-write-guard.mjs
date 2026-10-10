/**
 * Vercel Blob on Hobby allows 2,000 writes a month and blocks the whole store (reads too) for 30
 * days once a limit is passed. Every uploaded file is one write, so large batches need an explicit
 * go-ahead after checking the month's usage in the dashboard.
 */
export const WRITE_GUARD = 200;

/** `--allow-writes=N` from argv, or 0 when absent or not a positive integer. */
export function allowedWrites(argv) {
  const arg = argv.find((a) => a.startsWith('--allow-writes='));
  const n = arg ? Number(arg.split('=')[1]) : 0;
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Why a batch of `count` writes may not upload, or null when it may. */
export function writeGuardError(count, allowed) {
  if (count <= WRITE_GUARD || count <= allowed) return null;
  return (
    `This upload is ${count} Blob writes (the Hobby plan allows 2,000 a month, and going over blocks ` +
    `the store for 30 days). Check this month's usage in the Vercel dashboard (Observability → Blob), ` +
    `then run upload-exercise-demos.mjs with the same ids and --allow-writes=${count} if there is room ` +
    `(rendered clips stay in .exercise-demos/, so nothing needs re-rendering).`
  );
}
