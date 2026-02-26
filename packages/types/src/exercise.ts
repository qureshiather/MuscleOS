import type { MuscleId } from './muscles';

export interface Exercise {
  id: string;
  name: string;
  muscles: MuscleId[];
  equipment: Equipment[];
  instructions?: string;
  /** Optional video or image URL */
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
