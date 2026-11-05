import type { Exercise } from '@muscleos/types';

import { isCustomExerciseId } from '@/utils/exerciseIds';

/**
 * The exercise's page on muscleos.app: an animated demo where one exists, otherwise the same
 * how-to with "Demo coming soon". Every published catalog exercise has a page, so the app needs no
 * list of which demos exist. Customs and unpublished catalog rows have no page.
 */
export function exercisePageUrl(exercise: Pick<Exercise, 'id' | 'isPublished'>): string | undefined {
  if (isCustomExerciseId(exercise.id) || exercise.isPublished === false) return undefined;
  return `https://muscleos.app/exercises/${exercise.id}`;
}

/**
 * Public Vercel Blob folder holding the demo clips. Must match the website's
 * `apps/landing/app/data/exerciseDemoStore.json` (asserted in the test).
 */
export const DEMO_BASE_URL = 'https://vzyfuqbdgpfhuxjd.public.blob.vercel-storage.com/exercise-demos';

/**
 * The exercise's looping demo clip, rendered on the app's card colour for that theme (dark
 * `#1C1F2A`, light `#FFFFFF`). Every published catalog exercise gets one, like `exercisePageUrl`;
 * one whose clip isn't rendered yet fails to download and the body figures show instead.
 */
export function exerciseDemoVideoUrl(
  exercise: Pick<Exercise, 'id' | 'isPublished'>,
  theme: 'dark' | 'light'
): string | undefined {
  if (exercisePageUrl(exercise) === undefined) return undefined;
  return `${DEMO_BASE_URL}/${exercise.id}-${theme}.mp4`;
}

/**
 * The demo's still poster (a WebP at the far end of the rep, a few KB), for grids where a playing
 * clip per card would be too heavy. Same rules as `exerciseDemoVideoUrl`.
 */
export function exerciseDemoPosterUrl(
  exercise: Pick<Exercise, 'id' | 'isPublished'>,
  theme: 'dark' | 'light'
): string | undefined {
  if (exercisePageUrl(exercise) === undefined) return undefined;
  return `${DEMO_BASE_URL}/${exercise.id}-${theme}.webp`;
}

/**
 * How long a downloaded clip is used before it's fetched again. Re-rendered demos are uploaded
 * over the same URL, so a fixed clip reaches the app within this window.
 */
export const DEMO_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The cached file's name: the clip's own file name (`<id>-<theme>.mp4`), unique per clip. */
export function demoCacheFileName(videoUrl: string): string {
  return videoUrl.slice(videoUrl.lastIndexOf('/') + 1);
}

/** A cached clip is used as-is until it's `DEMO_CACHE_MAX_AGE_MS` old; then it's refreshed. */
export function demoCacheIsFresh(modifiedAtMs: number | undefined, nowMs: number): boolean {
  return modifiedAtMs != null && nowMs - modifiedAtMs < DEMO_CACHE_MAX_AGE_MS;
}
