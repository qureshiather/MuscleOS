import {
  EXERCISE_CATEGORY_LABELS,
  type Exercise,
  formatEquipmentLabels,
  formatMuscleLabels,
  instructionSteps,
} from '@muscleos/types';

/**
 * Display text and search for exercise rows. Kept apart from exercises.ts so client components
 * can use it without pulling the whole catalog into the browser bundle.
 */
type Row = Pick<Exercise, 'name' | 'muscles' | 'equipment'>;

export function muscleLine(e: Pick<Exercise, 'muscles'>): string {
  return formatMuscleLabels(e.muscles);
}

export function equipmentLine(e: Pick<Exercise, 'equipment'>): string {
  return formatEquipmentLabels(e.equipment);
}

export function categoryLabel(e: Pick<Exercise, 'category'>): string {
  return EXERCISE_CATEGORY_LABELS[e.category];
}

/** "Free Weight · Barbell"; just "Bodyweight" when the type and equipment say the same thing. */
export function typeLine(e: Pick<Exercise, 'category' | 'equipment'>): string {
  const category = categoryLabel(e);
  const equipment = equipmentLine(e);
  return !equipment || equipment === category ? category : `${category} · ${equipment}`;
}

/** Case-insensitive match on name, muscles and equipment; every word must match. */
export function filterExercises<T extends Row>(rows: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...rows];
  return rows.filter((e) => {
    const haystack = `${e.name} ${muscleLine(e)} ${equipmentLine(e)}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

/** Instruction steps as one line of prose, for meta descriptions and other single-line slots. */
export function instructionsSummary(e: Pick<Exercise, 'instructions'>): string | undefined {
  const steps = instructionSteps(e.instructions);
  return steps.length ? steps.map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)).join(' ') : undefined;
}
