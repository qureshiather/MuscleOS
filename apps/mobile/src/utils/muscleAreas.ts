import type { MuscleId } from '@muscleos/types';

export type MuscleAreaKey = 'chest' | 'shoulders' | 'back' | 'arms' | 'core' | 'legs';

export interface MuscleArea {
  key: MuscleAreaKey;
  label: string;
  muscles: MuscleId[];
}

/**
 * Body areas covering all 18 muscles exactly once, in head-to-toe order. The create-exercise form
 * offers them as shortcut chips (Shoulders selects all three delts) and as headings in its
 * specific-muscle view; the library Muscle filter reuses Legs, Back and Shoulders.
 *
 * Not derived from `MuscleGroup.region`: that field is the diagram's front/back split, which puts
 * the delts in two regions and abs with chest.
 */
export const MUSCLE_AREAS: MuscleArea[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'traps', 'rhomboids', 'lower_back'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'core', label: 'Core', muscles: ['abs', 'obliques'] },
  { key: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
];

export function muscleArea(key: MuscleAreaKey): MuscleArea {
  const area = MUSCLE_AREAS.find((a) => a.key === key);
  if (!area) throw new Error(`Unknown muscle area: ${key}`);
  return area;
}

export type AreaSelection = 'all' | 'some' | 'none';

/** How much of an area is selected. Drives the shortcut chip's on / partial / off state. */
export function areaSelection(selected: readonly MuscleId[], area: MuscleArea): AreaSelection {
  const count = area.muscles.filter((m) => selected.includes(m)).length;
  if (count === 0) return 'none';
  return count === area.muscles.length ? 'all' : 'some';
}

/** Shortcut chip tap: a fully selected area clears; otherwise its missing muscles are added. */
export function toggleArea(selected: readonly MuscleId[], area: MuscleArea): MuscleId[] {
  if (areaSelection(selected, area) === 'all') {
    return selected.filter((m) => !area.muscles.includes(m));
  }
  return [...selected, ...area.muscles.filter((m) => !selected.includes(m))];
}

export function toggleMuscle(selected: readonly MuscleId[], id: MuscleId): MuscleId[] {
  return selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id];
}

/**
 * Open the form on the specific-muscle view when the area chips can't show the selection
 * exactly, i.e. some area is only partly selected (an edited custom that targets Rear Delts).
 */
export function prefersSpecificMuscles(selected: readonly MuscleId[]): boolean {
  return MUSCLE_AREAS.some((area) => areaSelection(selected, area) === 'some');
}
