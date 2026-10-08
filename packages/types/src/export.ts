import type { WorkoutTemplate, TemplateFolder } from './workout';
import type { WorkoutSession } from './session';
import type { MuscleRecovery } from './recovery';
import type { UserProfile } from './auth';
import type { Exercise } from './exercise';

/** Full export payload for "Export my data" */
export interface ExportData {
  version: number;
  exportedAt: string; // ISO
  profile?: UserProfile;
  templates: WorkoutTemplate[];
  templateFolders?: TemplateFolder[];
  sessions: WorkoutSession[];
  recovery: MuscleRecovery[];
  /** User notes keyed by exercise id (seat height, lever settings, etc.) */
  exerciseNotes?: Record<string, string>;
  /** Account-private custom exercises */
  customExercises?: Exercise[];
}
