import { formatWeight, type WeightUnit } from '@/utils/weightUnits';

/**
 * Workout preview helpers (docs/features/templates.md#workout-preview).
 */

/** Seconds as `m:ss` — the preview's rest badge shows the app default (120 → `2:00`). */
export function formatRestDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * The card's Previous line, `Previous: <weight> × <reps>` in the display unit, or null (the line is
 * omitted) when there is no previous for the exercise. Reps are dropped when unknown.
 */
export function formatPrevious(
  prev: { weightKg: number; reps?: number } | null | undefined,
  unit: WeightUnit
): string | null {
  if (prev == null) return null;
  const reps = prev.reps != null ? ` × ${prev.reps}` : '';
  return `Previous: ${formatWeight(prev.weightKg, unit)}${reps}`;
}

export type PreviewEntryState = 'missing' | 'active-session' | 'ready';

/**
 * Entry guards other than the Pro gate: no template id or no exercises → "Missing workout
 * details"; a workout already in progress → redirect to `/active-workout`.
 */
export function previewEntryState(args: {
  templateId: string;
  exerciseIds: readonly string[];
  hasActiveSession: boolean;
}): PreviewEntryState {
  if (args.hasActiveSession) return 'active-session';
  if (!args.templateId || args.exerciseIds.length === 0) return 'missing';
  return 'ready';
}
