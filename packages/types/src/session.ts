/** A single set within an exercise */
export interface SetRecord {
  reps?: number;
  weightKg?: number;
  completed: boolean;
  /** Warm-up set (lighter weight, labeled separately in the log) */
  isWarmUp?: boolean;
  /** Optional note */
  note?: string;
  /**
   * `weightKg` is an auto-filled suggestion (from "previous" or carried over), not user-entered.
   * The keypad overwrites it on the first digit instead of appending, and it renders as a muted
   * ghost. Cleared once the field is edited or the set is completed. Never persisted to finished
   * sessions.
   */
  weightPrefilled?: boolean;
  /** `reps` is an auto-filled suggestion, not user-entered. See {@link weightPrefilled}. */
  repsPrefilled?: boolean;
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
