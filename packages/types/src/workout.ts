export interface TemplateFolder {
  id: string;
  name: string;
  /** Pinned to top of folder list when true */
  favorite?: boolean;
  /** Hidden in archived section at bottom when true */
  archived?: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  /** Exercise IDs in order for this workout */
  exerciseIds: string[];
  /** Default number of sets per exercise. Omit or undefined = app default (3). */
  defaultSets?: number;
  /** Built-in templates are read-only */
  isBuiltIn?: boolean;
  /** Optional folder for custom templates. Omit = uncategorized. */
  folderId?: string;
}

export interface PlannedWorkout {
  id: string;
  templateId: string;
  scheduledAt: string; // ISO date
  /** Optional: override exercise list for this instance */
  exerciseIds?: string[];
}
