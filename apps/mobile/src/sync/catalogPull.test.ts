import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Catalog delta pull (docs/features/exercise-library.md#reconciliation-and-sync). */

const supa = vi.hoisted(() => {
  const state = {
    configured: true,
    result: { data: [] as unknown[] | null, error: null as { message: string } | null },
    calls: [] as [string, ...unknown[]][],
  };
  const query = {
    select: (...args: unknown[]) => (state.calls.push(['select', ...args]), query),
    gt: (...args: unknown[]) => (state.calls.push(['gt', ...args]), query),
    order: async (...args: unknown[]) => (state.calls.push(['order', ...args]), state.result),
  };
  return {
    state,
    module: {
      supabase: { from: (table: string) => (state.calls.push(['from', table]), query) },
      isSupabaseConfigured: () => state.configured,
    },
  };
});

vi.mock('@/lib/supabase', () => supa.module);

import { fetchCatalogDelta } from './catalogPull';

const WM = '2026-10-02T00:00:00.000Z';

beforeEach(() => {
  supa.state.configured = true;
  supa.state.result = { data: [], error: null };
  supa.state.calls = [];
  vi.stubGlobal('__DEV__', false);
});

describe('fetchCatalogDelta', () => {
  it('queries rows updated after the watermark, oldest first', async () => {
    await fetchCatalogDelta(WM);
    expect(supa.state.calls).toContainEqual(['from', 'catalog_exercises']);
    expect(supa.state.calls).toContainEqual(['gt', 'updated_at', WM]);
    expect(supa.state.calls).toContainEqual(['order', 'updated_at', { ascending: true }]);
  });

  it('maps rows to exercises and advances the watermark to the max updated_at', async () => {
    supa.state.result = {
      data: [
        {
          id: 'bench-press',
          name: 'Bench Press',
          instructions: 'Cue',
          category: 'free_weight',
          muscles: ['chest'],
          equipment: ['barbell'],
          aliases: [],
          tracking_type: 'weight_reps',
          is_published: true,
          updated_at: '2026-10-04T00:00:00.000Z',
        },
        {
          id: 'stationary-bike',
          name: 'Stationary Bike',
          instructions: null,
          category: 'machine',
          muscles: ['quads'],
          equipment: ['machine'],
          aliases: [],
          tracking_type: 'weight_reps',
          is_published: false,
          updated_at: '2026-10-03T00:00:00.000Z',
        },
      ],
      error: null,
    };
    const result = await fetchCatalogDelta(WM);
    expect(result.watermark).toBe('2026-10-04T00:00:00.000Z');
    expect(result.exercises.map((e) => [e.id, e.instructions, e.isPublished])).toEqual([
      ['bench-press', 'Cue', true],
      ['stationary-bike', undefined, false],
    ]);
  });

  it('keeps the watermark and returns nothing on error', async () => {
    supa.state.result = { data: null, error: { message: 'boom' } };
    expect(await fetchCatalogDelta(WM)).toEqual({ exercises: [], watermark: WM });
  });

  it('skips the network when Supabase is not configured', async () => {
    supa.state.configured = false;
    expect(await fetchCatalogDelta(WM)).toEqual({ exercises: [], watermark: WM });
    expect(supa.state.calls).toEqual([]);
  });
});
