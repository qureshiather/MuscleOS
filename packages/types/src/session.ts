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
  /** Rest after every working set, in seconds. Omitted means the app default (120). 0 means no rest. */
  restBetweenSetsSeconds?: number;
  /** Rest after every warm-up set, in seconds. Omitted or 0 means warm-ups do not start a timer. */
  warmUpRestSeconds?: number;
}

/** A completed or in-progress workout session */
export interface WorkoutSession {
  id: string;
  templateId: string;
  startedAt: string; // ISO
  completedAt?: string; // ISO, undefined if in progress
  exercises: SessionExercise[];
}
