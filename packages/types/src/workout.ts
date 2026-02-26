export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  /** Day labels for the split, e.g. ['Push', 'Pull', 'Legs'] */
  days: WorkoutDay[];
  /** Built-in templates are read-only */
  isBuiltIn?: boolean;
}

export interface WorkoutDay {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface PlannedWorkout {
  id: string;
  templateId: string;
  dayId: string;
  dayName: string;
  scheduledAt: string; // ISO date
  /** Optional: override exercise list for this instance */
  exerciseIds?: string[];
}
