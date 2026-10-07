import { EXERCISE_DEMO_IDS } from '@/data/exerciseDemos';

const DEMO_IDS = new Set(EXERCISE_DEMO_IDS);

/**
 * The website page with an animated demo of this exercise, or undefined when it has none yet.
 * The clips live on muscleos.app only (never bundled in the app); the detail sheet links out.
 */
export function exerciseDemoUrl(exerciseId: string): string | undefined {
  return DEMO_IDS.has(exerciseId) ? `https://muscleos.app/exercises/${exerciseId}` : undefined;
}
