export interface TemplateFolder {
  id: string;
  name: string;
  /** Pinned to top of folder list when true */
  favorite?: boolean;
  /** Hidden in archived section at bottom when true */
  archived?: boolean;
}

/** One exercise slot on a template, with the set structure used when a workout starts. */
export interface TemplateExercise {
  exerciseId: string;
  /** Working sets to create at start. Omit → app default (3). Min 1. */
  sets?: number;
  /** Warm-up sets prepended at start. Omit → 0. */
  warmUpSets?: number;
  /** Rest after every working set, in seconds; copied to the session. Omit → the user's Default rest (Settings, 120 unless changed). 0 → no rest. */
  restBetweenSetsSeconds?: number;
  /** Rest after every warm-up set, in seconds; copied to the session. Omit or 0 → no timer. */
  warmUpRestSeconds?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  /** Exercise IDs in order for this workout */
  exerciseIds: string[];
  /**
   * Per-exercise set structure, same order as `exerciseIds`.
   * When omitted, every exercise uses `defaultSets` working sets (or 3) and 0 warm-ups.
   */
  exercises?: TemplateExercise[];
  /**
   * Legacy template-wide working-set default, used only when `exercises` is absent.
   * Omit or undefined = app default (3). New writes expand this into `exercises`.
   */
  defaultSets?: number;
  /** Built-in templates are read-only */
  isBuiltIn?: boolean;
  /** Optional folder for custom templates. Omit = no folder (shown at top of Custom). */
  folderId?: string;
  /** Soft-hidden from main lists. Custom templates only; built-ins reach the list only through the chosen program. */
  hidden?: boolean;
}

export interface PlannedWorkout {
  id: string;
  templateId: string;
  scheduledAt: string; // ISO date
  /** Optional: override exercise list for this instance */
  exerciseIds?: string[];
}

/**
 * A built-in program: one shipped folder of templates plus the facts the Programs screen shows.
 * At most one program is in Your workouts at a time (`activeProgramId` in app settings).
 */
export interface BuiltInProgram {
  /** The built-in folder id (`builtin_ppl`). */
  id: string;
  name: string;
  summary: string;
  daysPerWeek: string;
  level: 'Beginner' | 'Intermediate';
}
