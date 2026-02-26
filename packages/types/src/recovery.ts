import type { MuscleId } from './muscles';

export const DEFAULT_RECOVERY_HOURS = 72;

export interface MuscleRecovery {
  muscleId: MuscleId;
  trainedAt: string; // ISO
  recoveryUntil: string; // ISO
}
