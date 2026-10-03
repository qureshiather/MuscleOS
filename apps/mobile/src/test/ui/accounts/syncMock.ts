/**
 * Factory for `jest.mock('@/sync', syncModuleMock)`: every export of src/sync/index.ts as a jest.fn,
 * so screens and stores can run with no network. Read calls back through `jest.requireMock('@/sync')`.
 */
export function syncModuleMock() {
  const names = [
    'isCloudSyncEnabled',
    'schedulePush',
    'pushNow',
    'pullNow',
    'syncNow',
    'syncAfterWorkout',
    'onAccountLinked',
    'resetSyncTransport',
    'notifySessionUpsert',
    'notifySessionDelete',
    'notifyTemplateUpsert',
    'notifyTemplateDelete',
    'notifyFolderUpsert',
    'notifyFolderDelete',
    'notifyCustomExerciseUpsert',
    'notifyCustomExerciseDelete',
    'notifyExercisePreviousSnapshot',
    'notifyExerciseNotesSnapshot',
    'notifyAppSettingsSnapshot',
  ];
  const mod: Record<string, jest.Mock> = {};
  for (const name of names) mod[name] = jest.fn();
  mod.syncNow.mockResolvedValue(undefined);
  mod.isCloudSyncEnabled.mockReturnValue(false);
  return mod;
}
