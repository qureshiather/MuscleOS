import type { TemplateExercise, WorkoutTemplate } from '@muscleos/types';

/** Working sets created for each exercise when a template doesn't specify otherwise. */
export const DEFAULT_SETS_PER_EXERCISE = 3;

export type ResolvedTemplateExercise = {
  exerciseId: string;
  sets: number;
  warmUpSets: number;
};

export function clampWorkingSets(
  n: unknown,
  fallback: number = DEFAULT_SETS_PER_EXERCISE
): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(1, Math.floor(v));
}

export function clampWarmUpSets(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

/**
 * Expand a stored template into a per-exercise plan.
 *
 * `exercises` wins when present (omitted `sets` → 3, omitted `warmUpSets` → 0).
 * Otherwise every id uses `defaultSets` (or 3) working sets and 0 warm-ups.
 */
export function resolveTemplateExercises(
  template: Pick<WorkoutTemplate, 'exerciseIds' | 'exercises' | 'defaultSets'>
): ResolvedTemplateExercise[] {
  const usePerExercise = (template.exercises?.length ?? 0) > 0;
  const ids = template.exerciseIds.length
    ? template.exerciseIds
    : (template.exercises ?? []).map((ex) => ex.exerciseId);
  const fallbackSets = usePerExercise
    ? DEFAULT_SETS_PER_EXERCISE
    : clampWorkingSets(template.defaultSets);

  return ids.map((exerciseId, i) => {
    const cfg = usePerExercise ? template.exercises?.[i] : undefined;
    return {
      exerciseId,
      sets: clampWorkingSets(cfg?.sets, fallbackSets),
      warmUpSets: clampWarmUpSets(cfg?.warmUpSets),
    };
  });
}

export function compactTemplateExercise(ex: ResolvedTemplateExercise): TemplateExercise {
  return {
    exerciseId: ex.exerciseId,
    ...(ex.sets !== DEFAULT_SETS_PER_EXERCISE && { sets: ex.sets }),
    ...(ex.warmUpSets > 0 && { warmUpSets: ex.warmUpSets }),
  };
}

/** Persist `exerciseIds` plus a compact `exercises` array (omitted fields mean 3 / 0). */
export function serializeTemplateExercises(
  plan: readonly ResolvedTemplateExercise[]
): Pick<WorkoutTemplate, 'exerciseIds' | 'exercises'> {
  const exerciseIds = plan.map((p) => p.exerciseId);
  if (plan.length === 0) return { exerciseIds };
  return {
    exerciseIds,
    exercises: plan.map(compactTemplateExercise),
  };
}

export function normalizeWorkoutTemplate(template: WorkoutTemplate): WorkoutTemplate {
  const serialized = serializeTemplateExercises(resolveTemplateExercises(template));
  const next: WorkoutTemplate = {
    id: template.id,
    name: template.name,
    exerciseIds: serialized.exerciseIds,
  };
  if (template.description != null) next.description = template.description;
  if (serialized.exercises) next.exercises = serialized.exercises;
  if (template.isBuiltIn !== undefined) next.isBuiltIn = template.isBuiltIn;
  if (template.folderId != null) next.folderId = template.folderId;
  if (template.hidden === true) next.hidden = true;
  return next;
}

export function templateExercisesFromSession(
  exercises: readonly { exerciseId: string; sets: readonly { isWarmUp?: boolean }[] }[]
): ResolvedTemplateExercise[] {
  return exercises.map((ex) => {
    const warmUpSets = ex.sets.filter((s) => s.isWarmUp === true).length;
    const working = ex.sets.length - warmUpSets;
    return {
      exerciseId: ex.exerciseId,
      sets: Math.max(1, working),
      warmUpSets,
    };
  });
}

export function formatTemplateSetLabel(sets: number, warmUpSets: number): string {
  const working = sets === 1 ? '1 set' : `${sets} sets`;
  if (warmUpSets <= 0) return working;
  const warmUp = warmUpSets === 1 ? '1 warm-up' : `${warmUpSets} warm-ups`;
  return `${warmUp} · ${working}`;
}
