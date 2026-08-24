import type { WorkoutSession, WorkoutTemplate, TemplateFolder, Exercise, MuscleRecovery } from '@muscleos/types';
import type { ExercisePrevious } from '@/storage/localStorage';
import { enqueueOutbox } from './outbox';
import { isCloudSyncEnabled, schedulePush } from './syncEngine';

function touch(): void {
  schedulePush();
}

export function notifySessionUpsert(session: WorkoutSession): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'session',
    entityId: session.id,
    op: 'upsert',
    payload: session,
    updatedAt: session.completedAt ?? session.startedAt,
  });
  touch();
}

export function notifySessionDelete(sessionId: string): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'session',
    entityId: sessionId,
    op: 'delete',
    updatedAt: new Date().toISOString(),
  });
  touch();
}

export function notifyTemplateUpsert(template: WorkoutTemplate): void {
  if (!isCloudSyncEnabled()) return;
  const updatedAt = new Date().toISOString();
  void enqueueOutbox({
    entityType: 'template',
    entityId: template.id,
    op: 'upsert',
    payload: template,
    updatedAt,
  });
  touch();
}

export function notifyTemplateDelete(templateId: string): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'template',
    entityId: templateId,
    op: 'delete',
    updatedAt: new Date().toISOString(),
  });
  touch();
}

export function notifyFolderUpsert(folder: TemplateFolder): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'template_folder',
    entityId: folder.id,
    op: 'upsert',
    payload: folder,
    updatedAt: new Date().toISOString(),
  });
  touch();
}

export function notifyFolderDelete(folderId: string): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'template_folder',
    entityId: folderId,
    op: 'delete',
    updatedAt: new Date().toISOString(),
  });
  touch();
}

export function notifyCustomExerciseUpsert(exercise: Exercise): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'custom_exercise',
    entityId: exercise.id,
    op: 'upsert',
    payload: exercise,
    updatedAt: new Date().toISOString(),
  });
  touch();
}

export function notifyCustomExerciseDelete(exerciseId: string): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'custom_exercise',
    entityId: exerciseId,
    op: 'delete',
    updatedAt: new Date().toISOString(),
  });
  touch();
}

export function notifyRecoverySnapshot(recovery: MuscleRecovery[]): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'recovery',
    entityId: 'default',
    op: 'upsert',
    payload: recovery,
    updatedAt: recovery.at(-1)?.trainedAt ?? new Date().toISOString(),
  });
  touch();
}

export function notifyExercisePreviousSnapshot(previous: Record<string, ExercisePrevious>): void {
  if (!isCloudSyncEnabled()) return;
  void enqueueOutbox({
    entityType: 'exercise_previous',
    entityId: 'default',
    op: 'upsert',
    payload: previous,
    updatedAt: new Date().toISOString(),
  });
  touch();
}
