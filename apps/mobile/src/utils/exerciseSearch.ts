import type { Exercise } from '@muscleos/types';
import { EXERCISE_CATEGORY_LABELS, MUSCLE_GROUPS } from '@muscleos/types';

export function exerciseMatchesQuery(exercise: Exercise, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (exercise.name.toLowerCase().includes(q)) return true;
  if (exercise.aliases?.some((alias) => alias.toLowerCase().includes(q))) return true;
  if (exercise.category.replace('_', ' ').includes(q)) return true;
  if (EXERCISE_CATEGORY_LABELS[exercise.category].toLowerCase().includes(q)) return true;
  if (
    exercise.muscles.some((id) => {
      const group = MUSCLE_GROUPS[id];
      return group?.name.toLowerCase().includes(q) || id.includes(q);
    })
  ) {
    return true;
  }
  return exercise.equipment.some((eq) => eq.toLowerCase().includes(q));
}

export function buildExerciseAliasMap(exercises: Exercise[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const exercise of exercises) {
    for (const alias of exercise.aliases ?? []) {
      map.set(alias, exercise.id);
    }
  }
  return map;
}
