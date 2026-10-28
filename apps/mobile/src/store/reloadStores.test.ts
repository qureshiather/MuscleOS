import { describe, expect, it, vi } from 'vitest';

/** docs/features/accounts-and-data.md#data — exercises reload before the stores that resolve them. */

const events = vi.hoisted(() => [] as string[]);
const store = vi.hoisted(
  () => (name: string) => ({
    getState: () => ({
      load: async () => {
        events.push(`${name}:start`);
        await Promise.resolve();
        events.push(`${name}:done`);
      },
    }),
  })
);
vi.mock('@/store/exercisesStore', () => ({ useExercisesStore: store('exercises') }));
vi.mock('@/store/sessionsStore', () => ({ useSessionsStore: store('sessions') }));
vi.mock('@/store/templatesStore', () => ({ useTemplatesStore: store('templates') }));
vi.mock('@/store/recoveryStore', () => ({ useRecoveryStore: store('recovery') }));
vi.mock('@/store/exerciseNotesStore', () => ({ useExerciseNotesStore: store('notes') }));
vi.mock('@/store/settingsStore', () => ({ useSettingsStore: store('settings') }));

const { reloadAllStores } = await import('./reloadStores');

describe('reloadAllStores', () => {
  it('finishes loading exercises before any other store starts, then reloads every data store', async () => {
    await reloadAllStores();
    expect(events.slice(0, 2)).toEqual(['exercises:start', 'exercises:done']);
    const started = events.filter((e) => e.endsWith(':start')).map((e) => e.split(':')[0]);
    expect(started.sort()).toEqual(['exercises', 'notes', 'recovery', 'sessions', 'settings', 'templates']);
  });
});
