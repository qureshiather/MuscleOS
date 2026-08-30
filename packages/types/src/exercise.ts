import type { MuscleId } from './muscles';

export type ExerciseCategory = 'free_weight' | 'machine' | 'cable' | 'bodyweight';

export type ExerciseTrackingType = 'weight_reps' | 'bodyweight_reps' | 'duration';

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
  trackingType?: ExerciseTrackingType;
  /** Catalog only. Unpublished rows stay resolvable for history. */
  isPublished?: boolean;
  /** @deprecated unused; kept optional for older cached rows */
  mediaUrl?: string;
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
