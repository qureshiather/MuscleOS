import type { MuscleId } from './muscles';

export type ExerciseCategory = 'free_weight' | 'machine' | 'cable' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscles: MuscleId[];
  equipment: Equipment[];
  /** Library filter: machine / free weight / bodyweight / cable */
  category: ExerciseCategory;
  instructions?: string;
  /** Search helpers and legacy slugs */
  aliases?: string[];
  /** Catalog only. Unpublished rows stay resolvable for history. */
  isPublished?: boolean;
}

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'band'
  | 'ez_bar'
  | 'other';

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'free_weight',
  'machine',
  'cable',
  'bodyweight',
];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  free_weight: 'Free Weight',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  band: 'Band',
  ez_bar: 'EZ Bar',
  other: 'Other',
};

export function equipmentLabel(id: Equipment): string {
  return EQUIPMENT_LABELS[id] ?? id.replace(/_/g, ' ');
}

export function formatEquipmentLabels(
  ids: readonly Equipment[],
  separator = ', '
): string {
  return ids.map(equipmentLabel).join(separator);
}

/**
 * Instruction copy split into steps for a numbered list. Catalog copy stores one step per line;
 * a custom exercise's free text may already be typed as a list, so leading `1.`, `-` or `•`
 * markers and blank lines are dropped. A single paragraph comes back as one step.
 */
export function instructionSteps(instructions: string | null | undefined): string[] {
  if (!instructions) return [];
  return instructions
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:\d+[.)]|[-•*])\s+/, '').trim())
    .filter(Boolean);
}
