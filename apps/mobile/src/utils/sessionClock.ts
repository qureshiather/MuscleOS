import type { WorkoutSession } from '@muscleos/types';

/**
 * A session's sync clock (`updated_at`): when it was last edited from History, else when it
 * finished, else when it started. An edit must move the clock forward, or other devices keep
 * their copy on a last-write-wins tie.
 */
export function sessionSyncClock(session: Pick<WorkoutSession, 'startedAt' | 'completedAt' | 'editedAt'>): string {
  return session.editedAt ?? session.completedAt ?? session.startedAt;
}
