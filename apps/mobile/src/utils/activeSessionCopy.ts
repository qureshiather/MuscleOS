import type { WorkoutSession } from '@muscleos/types';
import { isEditingFinishedSession } from '@/store/activeWorkoutLogic';

export type ActiveSessionCopy = {
  /** Resume pill on the tab bar. */
  resumeLabel: string;
  /** Leaves the open workout or edit without saving. */
  discardLabel: string;
  /** Dialog shown when something else is started while one is open. */
  blockedTitle: string;
  blockedStartMessage: string;
  blockedEditMessage: string;
};

const WORKOUT_COPY: ActiveSessionCopy = {
  resumeLabel: 'Resume workout',
  discardLabel: 'Cancel workout',
  blockedTitle: 'Workout in progress',
  blockedStartMessage: 'Finish or cancel your current workout before starting another.',
  blockedEditMessage: 'Finish or cancel your current workout before editing a past one.',
};

const EDIT_COPY: ActiveSessionCopy = {
  resumeLabel: 'Resume editing',
  discardLabel: 'Discard changes',
  blockedTitle: 'Edit in progress',
  blockedStartMessage: "Save or discard your changes to the workout you're editing before starting another.",
  blockedEditMessage: "Save or discard your changes to the workout you're editing first.",
};

/** One active session at a time: a running workout or an edit to a finished one. */
export function activeSessionCopy(session: Pick<WorkoutSession, 'completedAt'>): ActiveSessionCopy {
  return isEditingFinishedSession(session) ? EDIT_COPY : WORKOUT_COPY;
}
