import type { WorkoutTemplate, TemplateFolder } from './workout';
import type { WorkoutSession } from './session';
import type { MuscleRecovery } from './recovery';
import type { MacroTargets, MetabolismInfo } from './health';
import type { UserProfile } from './auth';
import type { SubscriptionState } from './subscription';
import type { Exercise } from './exercise';

/** Full export payload for "Export my data" */
export interface ExportData {
  version: number;
  exportedAt: string; // ISO
  profile?: UserProfile;
  subscription?: SubscriptionState;
  templates: WorkoutTemplate[];
  templateFolders?: TemplateFolder[];
  sessions: WorkoutSession[];
  recovery: MuscleRecovery[];
  /** User notes keyed by exercise id (seat height, lever settings, etc.) */
  exerciseNotes?: Record<string, string>;
  /** Account-private custom exercises */
  customExercises?: Exercise[];
  health?: {
    macroTargets?: MacroTargets;
    metabolism?: MetabolismInfo;
  };
}
