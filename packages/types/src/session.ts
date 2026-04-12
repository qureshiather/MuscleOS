/** A single set within an exercise */
export interface SetRecord {
  reps?: number;
  weightKg?: number;
  completed: boolean;
  /** Optional note */
  note?: string;
}

/** One exercise within a workout session */
export interface SessionExercise {
  exerciseId: string;
  sets: SetRecord[];
  /** Rest after every set in this exercise (including after the last set), in seconds; omit = app default. */
  restBetweenSetsSeconds?: number;
}

/** A completed or in-progress workout session */
export interface WorkoutSession {
  id: string;
  templateId: string;
  startedAt: string; // ISO
  completedAt?: string; // ISO, undefined if in progress
  exercises: SessionExercise[];
}
